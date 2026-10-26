-- ============================================================
-- 화면·Lambda 에서 쓰는 주요 쿼리 (Data API 에서는 :이름 으로 값을 넘긴다)
-- ============================================================

-- [홈] 보관 중인 습득물 수 / 오늘 들어온 수
SELECT
  count(*) FILTER (WHERE status IN ('보관중', '현장에 있음'))  AS total,
  count(*) FILTER (WHERE found_date = CURRENT_DATE)             AS today
FROM found_items;

-- [습득물] 카테고리별 개수
SELECT category, count(*) AS cnt
FROM found_items
WHERE status IN ('보관중', '현장에 있음')
GROUP BY category
ORDER BY cnt DESC;

-- [습득물] 목록 + 검색 (카테고리·출처·기간·검색어, 최신순 20개)
SELECT id, source, name, category, color, current_place, found_date, status, photo_url
FROM found_items
WHERE (:category::text IS NULL OR category = :category)
  AND (:source::text   IS NULL OR source   = :source)
  AND (:days::int      IS NULL OR found_date >= CURRENT_DATE - :days::int)
  AND (:keyword::text  IS NULL OR concat_ws(' ', name, category, sub_category, color, title, current_place, found_place, array_to_string(features, ' '))
                                   ILIKE '%' || :keyword || '%')
ORDER BY found_date DESC, created_at DESC
LIMIT 20;

-- [상세] 습득물 + 이동 기록
SELECT * FROM found_items WHERE id = :id;
SELECT found_place, current_place, message, created_at
FROM sightings WHERE item_id = :id ORDER BY created_at;

-- [챗봇 · 찾기] 지금 위치 1km 안, 같은 종류, 사진이 비슷한 순
--   :lng, :lat = 현재 위치 / :embedding = 잃어버린 물건 사진(또는 설명) 임베딩
SELECT id, name, color, current_place,
       round(ST_Distance(current_geo, ST_MakePoint(:lng, :lat)::geography)) AS meters,
       1 - (embedding <=> :embedding::vector)                             AS similarity
FROM found_items
WHERE category = :category
  AND status IN ('보관중', '현장에 있음')
  AND ST_DWithin(current_geo, ST_MakePoint(:lng, :lat)::geography, 1000)
ORDER BY embedding <=> :embedding::vector
LIMIT 5;

-- [챗봇 · 등록] 같은 물건 후보: 같은 종류, 500m 안, 최근 3일, 사진이 아주 비슷한 것
SELECT id, name, color, features, distinctive, current_place,
       1 - (embedding <=> :embedding::vector) AS similarity
FROM found_items
WHERE source = 'user'
  AND category = :category
  AND found_date >= CURRENT_DATE - 3
  AND ST_DWithin(current_geo, ST_MakePoint(:lng, :lat)::geography, 500)
ORDER BY embedding <=> :embedding::vector
LIMIT 3;

-- [챗봇 · 등록] 같은 물건으로 확인되면: 현재 위치만 바꾸고 목격 기록을 쌓는다 (삭제하지 않음)
--   (Data API 에서는 트랜잭션으로 묶는다)
UPDATE found_items
SET current_place = :current_place, current_geo = ST_MakePoint(:lng, :lat)::geography, status = '현장에 있음'
WHERE id = :item_id;
INSERT INTO sightings (item_id, reporter_id, found_place, current_place, current_geo, message, photo_url)
VALUES (:item_id, :user_id, :found_place, :current_place, ST_MakePoint(:lng, :lat)::geography, :message, :photo_url);

-- [매칭] 새 습득물이 들어오면: 찾는 중인 잃어버린 물건과 비교해서 matches + notifications
--   같은 종류 + 2km 안 + 사진 유사도 0.8 이상 (또는 색이 같음)
WITH new_item AS (SELECT * FROM found_items WHERE id = :item_id),
cand AS (
  SELECT l.id AS lost_id, l.user_id, l.name, l.color AS lost_color, n.id AS item_id, n.current_place,
         CASE WHEN l.embedding IS NOT NULL AND n.embedding IS NOT NULL
              THEN 1 - (l.embedding <=> n.embedding) ELSE 0.5 END AS score,
         (l.color IS NOT NULL AND l.color = n.color) AS same_color
  FROM lost_items l, new_item n
  WHERE l.status = '찾는 중'
    AND l.category = n.category
    AND (l.lost_geo IS NULL OR n.current_geo IS NULL OR ST_DWithin(l.lost_geo, n.current_geo, 2000))
),
hit AS (
  INSERT INTO matches (lost_id, item_id, score, reason)
  SELECT lost_id, item_id, score, CASE WHEN same_color THEN '종류와 색이 같아요' ELSE '사진이 비슷해요' END
  FROM cand WHERE score >= 0.8 OR same_color
  ON CONFLICT DO NOTHING
  RETURNING lost_id, item_id
)
INSERT INTO notifications (user_id, lost_id, item_id, message)
SELECT c.user_id, c.lost_id, c.item_id,
       '잃어버린 ‘' || coalesce(c.lost_color || ' ', '') || c.name || '’과 비슷한 물건이 등록됐어요. 지금 위치: ' || c.current_place
FROM hit h JOIN cand c USING (lost_id, item_id)
RETURNING user_id, message;

-- [마이페이지] 내가 등록한 습득물 / 잃어버린 물건(비슷한 물건 수) / 안 읽은 알림 수
SELECT id, name, current_place, found_date, status FROM found_items WHERE reporter_id = :user_id ORDER BY created_at DESC;

SELECT l.id, l.name, l.color, l.lost_place, l.status, l.created_at, count(m.item_id) AS match_count
FROM lost_items l LEFT JOIN matches m ON m.lost_id = l.id
WHERE l.user_id = :user_id
GROUP BY l.id
ORDER BY l.created_at DESC;

SELECT count(*) FROM notifications WHERE user_id = :user_id AND read_at IS NULL;

-- [수집 Lambda] 공공 API 한 건 넣기 (이미 있으면 상태·보관장소만 갱신)
INSERT INTO found_items (source, ext_atc_id, ext_fd_sn, name, category, sub_category, color, title, photo_url,
                         found_date, current_place, org_name, org_tel, note, status)
VALUES ('portal', :atc_id, :fd_sn, :name, :category, :sub_category, :color, :title, :photo_url,
        :found_date, :dep_place, :org_name, :org_tel, :note, '보관중')
ON CONFLICT (source, ext_atc_id, ext_fd_sn)
DO UPDATE SET current_place = EXCLUDED.current_place, status = EXCLUDED.status
RETURNING id, (xmax = 0) AS inserted;   -- inserted = true 인 것만 매칭 대상
