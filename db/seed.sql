-- ============================================================
-- 예시 데이터 (개발·발표 시연용). 실제 운영에서는 넣지 않는다.
--   좌표: 신구대(성남) 근처 / 서울 몇 곳 — ST_MakePoint(경도, 위도)
-- ============================================================

INSERT INTO users (id, email, name, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner@test.com',  '주인',   'x'),
  ('00000000-0000-0000-0000-000000000002', 'finder@test.com', '발견자', 'x');

-- 공공 API (포털기관)
INSERT INTO found_items (source, ext_atc_id, ext_fd_sn, name, category, sub_category, color, title,
                         found_date, found_place, current_place, current_geo, org_name, org_tel, note, status)
VALUES
  ('portal', 'V0001882C05180022', '1', '반지갑', '지갑', '남성용 지갑', '검정',
   '반지갑(블랙(검정)색)을 습득하여 보관하고 있습니다.', CURRENT_DATE, '대합실', '수서역(에스알고속철도)',
   ST_MakePoint(127.1043, 37.4874)::geography, '수서역', '1544-7788', '카드 2장', '보관중'),
  ('portal', 'V0000058B04190002', '1', '여성용 반지갑', '지갑', '여성용 지갑', '분홍',
   '여성용 반지갑(퓨시아(자홍)색)을 습득하여 보관하고 있습니다.', CURRENT_DATE - 2, '지하 1층', '서울스퀘어',
   ST_MakePoint(126.9731, 37.5547)::geography, '서울스퀘어 안내데스크', NULL, NULL, '보관중');

-- 사용자 제보 (+ 이동 기록)
INSERT INTO found_items (id, source, name, category, sub_category, color, features, distinctive, title,
                         found_date, found_place, current_place, current_geo, status, reporter_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'user', '무선이어폰', '전자기기', '무선이어폰', '흰색',
   '{곰돌이 스티커, 케이스 모서리 긁힘}', true, '흰색 무선이어폰 케이스, 곰돌이 스티커',
   CURRENT_DATE, '신구대 도서관 1층 열람실', '신구대 도서관 1층 안내데스크 옆 벤치',
   ST_MakePoint(127.1328, 37.4372)::geography, '현장에 있음', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000002', 'user', '장우산', '우산', '장우산', '남색',
   '{나무 손잡이}', true, '남색 장우산, 나무 손잡이',
   CURRENT_DATE - 1, '신구대 정문 버스정류장', '신구대 정문 경비실',
   ST_MakePoint(127.1316, 37.4361)::geography, '현장에 있음', '00000000-0000-0000-0000-000000000002');

INSERT INTO sightings (item_id, reporter_id, found_place, current_place, message, created_at) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '신구대 도서관 1층 열람실', '신구대 도서관 1층 열람실', '열람실 책상 위에 있었어요', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000001', NULL,
   '신구대 도서관 1층 열람실', '신구대 도서관 1층 안내데스크 옆 벤치', '오늘 신구대에서 이거 봤는데 옆에 올려둘게요', now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
   '신구대 정문 버스정류장', '신구대 정문 경비실', '정류장 의자에 있어서 경비실에 맡겼어요', now() - interval '1 day');

-- 잃어버린 물건 (주인이 챗봇으로 등록)
INSERT INTO lost_items (id, user_id, name, category, color, features, lost_place, lost_geo) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '장우산', '우산', '검정', '{}', '신구대 정문', ST_MakePoint(127.1316, 37.4361)::geography);

INSERT INTO sync_state (source, last_date, last_run_at, last_count) VALUES ('portal', CURRENT_DATE, now(), 2);
