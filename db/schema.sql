-- ============================================================
-- 다시찾기 (분실물 찾기 서비스) — PostgreSQL 스키마
--   대상: Aurora PostgreSQL / RDS PostgreSQL / 로컬 PostgreSQL 15 이상
--   확장: PostGIS(위치 검색), pgvector(사진 유사도)
--
--   테이블 7개
--     users          사용자
--     found_items    습득물 (공공 API + 사용자 제보를 한 테이블에)
--     sightings      목격 기록 (습득물 1 : N, 지우지 않고 쌓음)
--     lost_items     잃어버린 물건 (챗봇 "잃어버렸어요" → 자동 등록)
--     matches        잃어버린 물건 ↔ 습득물 비슷함 판정 결과 (N : M)
--     notifications  알림 (비슷한 습득물이 등록되면)
--     sync_state     공공 API 수집 진행 상황
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;   -- 위치: "지금 위치 500m 안"
CREATE EXTENSION IF NOT EXISTS vector;    -- 사진 임베딩 비교: "사진이 비슷한 물건"
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ------------------------------------------------------------
-- 1. 사용자
-- ------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,                 -- 비밀번호는 해시만 저장 (bcrypt 등)
  push_token    text,                          -- 휴대폰 푸시 알림 토큰 (Expo push token)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. 습득물
--    source = 'portal'(포털기관 API) | 'police'(경찰청 API) | 'user'(사용자 제보)
--    공공 API 물건은 (source, ext_atc_id, ext_fd_sn) 로 한 번만 들어오게 막는다
-- ------------------------------------------------------------
CREATE TABLE found_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL CHECK (source IN ('portal', 'police', 'user')),
  ext_atc_id     text,                         -- 공공 API 관리ID (atcId)
  ext_fd_sn      text,                         -- 공공 API 습득순번 (fdSn)

  name           text NOT NULL,                -- 물품명       예: 반지갑
  category       text NOT NULL,                -- 대분류       예: 지갑
  sub_category   text,                         -- 중분류       예: 남성용 지갑
  color          text,                         -- 색상         예: 검정
  features       text[] NOT NULL DEFAULT '{}', -- 특징         예: {곰돌이 스티커, 모서리 긁힘}
  distinctive    boolean NOT NULL DEFAULT false, -- 고유한 흔적이 있는지 (같은 물건 판단에 씀)
  title          text,                         -- 게시제목 (fdSbjt)
  photo_url      text,                         -- 사진 (S3 또는 공공 API 이미지 주소)

  found_date     date NOT NULL,                -- 습득일
  found_place    text,                         -- 처음 발견한 곳
  current_place  text NOT NULL,                -- 지금 물건이 있는 곳 (보관장소 depPlace / 최신 제보 위치)
  current_geo    geography(Point, 4326),       -- 지금 위치 좌표 (경도, 위도)

  org_name       text,                         -- 보관 기관명 (공공 API)
  org_tel        text,                         -- 보관 기관 전화번호
  note           text,                         -- 특이사항 (uniq)

  status         text NOT NULL DEFAULT '보관중'
                 CHECK (status IN ('보관중', '현장에 있음', '현장에 없음', '주인 찾음')),
  reporter_id    uuid REFERENCES users(id) ON DELETE SET NULL,  -- 사용자 제보: 처음 올린 사람
  embedding      vector(1024),                 -- 사진 임베딩 (Bedrock Titan Multimodal, 1024차원)

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source, ext_atc_id, ext_fd_sn),
  CHECK (source = 'user' OR ext_atc_id IS NOT NULL)  -- 공공 API 물건은 관리ID 필수
);

CREATE INDEX found_items_category_date ON found_items (category, found_date DESC);
CREATE INDEX found_items_date          ON found_items (found_date DESC);
CREATE INDEX found_items_geo           ON found_items USING gist (current_geo);
CREATE INDEX found_items_embedding     ON found_items USING hnsw (embedding vector_cosine_ops);
CREATE INDEX found_items_reporter      ON found_items (reporter_id);

-- ------------------------------------------------------------
-- 3. 목격 기록 — 같은 물건이라고 확인된 제보가 시간 순서로 쌓인다 (삭제하지 않음)
-- ------------------------------------------------------------
CREATE TABLE sightings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  reporter_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  found_place    text NOT NULL,                -- 이번 제보자가 발견한 곳
  found_geo      geography(Point, 4326),
  current_place  text NOT NULL,                -- 이번 제보 뒤 물건이 있는 곳 ("옆 벤치로 옮김")
  current_geo    geography(Point, 4326),
  message        text,                         -- 제보 원문 ("오늘 신구대에서 이거 봤는데 옆에 올려둘게요")
  photo_url      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sightings_item ON sightings (item_id, created_at);

-- ------------------------------------------------------------
-- 4. 잃어버린 물건 — 챗봇에서 "잃어버렸어요"로 물어보면 등록
-- ------------------------------------------------------------
CREATE TABLE lost_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           text NOT NULL,                -- 예: 장우산
  category       text NOT NULL,
  color          text,
  features       text[] NOT NULL DEFAULT '{}',
  photo_url      text,                         -- 잃어버린 물건 사진이 있으면
  lost_place     text NOT NULL,
  lost_geo       geography(Point, 4326),
  lost_date      date NOT NULL DEFAULT CURRENT_DATE,
  status         text NOT NULL DEFAULT '찾는 중' CHECK (status IN ('찾는 중', '찾음')),
  embedding      vector(1024),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lost_items_user   ON lost_items (user_id, created_at DESC);
CREATE INDEX lost_items_active ON lost_items (category) WHERE status = '찾는 중';

-- ------------------------------------------------------------
-- 5. 비슷함 판정 결과 — 잃어버린 물건 N : M 습득물
-- ------------------------------------------------------------
CREATE TABLE matches (
  lost_id        uuid NOT NULL REFERENCES lost_items(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  score          real NOT NULL,                -- 0~1, 높을수록 비슷함
  reason         text,                         -- AI 가 적은 이유 ("색과 스티커가 같아요")
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lost_id, item_id)
);
CREATE INDEX matches_item ON matches (item_id);

-- ------------------------------------------------------------
-- 6. 알림
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lost_id        uuid REFERENCES lost_items(id) ON DELETE CASCADE,
  item_id        uuid REFERENCES found_items(id) ON DELETE CASCADE,
  message        text NOT NULL,
  read_at        timestamptz,                  -- NULL 이면 안 읽음
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);

-- ------------------------------------------------------------
-- 7. 공공 API 수집 진행 상황 (수집 Lambda 가 어디까지 가져왔는지)
-- ------------------------------------------------------------
CREATE TABLE sync_state (
  source         text PRIMARY KEY CHECK (source IN ('portal', 'police')),
  last_date      date,                         -- 마지막으로 가져온 습득일
  last_run_at    timestamptz,
  last_count     int,
  last_error     text
);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER found_items_touch BEFORE UPDATE ON found_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
