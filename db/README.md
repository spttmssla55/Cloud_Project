# DB — PostgreSQL

| 파일 | 내용 |
|---|---|
| `schema.sql` | 테이블 7개 생성 (먼저 실행) |
| `seed.sql` | 시연용 예시 데이터 (선택) |
| `queries.sql` | 화면·Lambda 에서 쓰는 주요 쿼리 |
| `erd.png` / `erd.mmd` | ERD 그림 / 원본 (Mermaid) |

## 테이블

| 테이블 | 내용 | 관계 |
|---|---|---|
| `users` | 사용자 | |
| `found_items` | 습득물 (공공 API + 사용자 제보를 한 테이블에, `source` 로 구분) | `reporter_id → users` |
| `sightings` | 목격·이동 기록 (지우지 않고 쌓음) | `item_id → found_items` (1:N) |
| `lost_items` | 잃어버린 물건 (챗봇 "잃어버렸어요" → 자동 등록) | `user_id → users` |
| `matches` | 잃어버린 물건 ↔ 습득물 비슷함 판정 | N:M (`lost_id`, `item_id`) |
| `notifications` | 알림 | `user_id`, `lost_id`, `item_id` |
| `sync_state` | 공공 API 수집 진행 상황 | |

## PostgreSQL 을 고른 이유

- **FK 로 관계를 표현** → ERD 가 그대로 DB 구조
- **PostGIS**: `ST_DWithin(current_geo, 내 위치, 1000)` 로 "1km 안의 습득물"
- **pgvector**: 사진 임베딩(Bedrock Titan Multimodal, 1024차원)끼리 `<=>` 로 "사진이 비슷한 물건"
- 공공 API 중복 수집은 `UNIQUE (source, ext_atc_id, ext_fd_sn)` + `ON CONFLICT` 로 막음

## 규칙

- **삭제하지 않는다**: 같은 물건 제보는 `found_items.current_place` 만 바꾸고 `sightings` 에 쌓는다. 상태는 `status` 로만 바꾼다.
- **흔한 물건**(`distinctive = false`)은 사진만으로 합치지 않는다 → 제보자 확인 후 합치거나 따로 등록.
- 비밀번호는 `password_hash` 만 저장. DB 접속 정보와 공공데이터 인증키는 **Lambda 환경 변수 / Secrets Manager** 에만.

## 확인한 환경

PostgreSQL 16 + PostGIS + pgvector 에서 `schema.sql` → `seed.sql` → `queries.sql` 의 쿼리 14개를 모두 실행해 확인.
