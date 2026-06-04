-- H17 created_by normalization from approved CSV
-- NO EJECUTAR SIN BACKUP Y APROBACION
-- Generated from local CSV validation with approved Elsa and Mario mappings. Default transaction ends with ROLLBACK.
-- Scope: update teachers.created_by only when it is currently NULL.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'nomina_docente' THEN
    RAISE EXCEPTION 'Guard failed: expected database nomina_docente, got %', current_database();
  END IF;
END
$$;

CREATE TEMP TABLE h17_created_by_mapping (
  teacher_id uuid PRIMARY KEY,
  coordinator_user_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO h17_created_by_mapping (teacher_id, coordinator_user_id) VALUES
  ('18b0878f-8f62-4802-b9d4-fa4f302defc6', '7209f83b-e73f-4fe7-87b4-bb13a0e490e6'),
  ('6e39d8fa-1de2-46e1-98ca-fbb5bc155544', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('12867774-a79c-43af-b1d9-32c101089161', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('577771b0-5068-457f-985d-97057994efcc', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('67d06850-42b4-439b-9fac-0978cd1e0039', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('a73630e2-9af4-46fc-9762-179ca98e92e2', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('f871b855-d760-448b-804d-e2b07e55acaa', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('31078d38-c0e7-4e94-a665-f1bd85dbc607', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('1f1be508-50b4-422a-9835-062929f96394', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('efb7819b-da3e-47ec-8fd7-205d58901dc3', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('21bcc1db-100e-4d30-9b91-2e88cdef6928', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('0e696bb4-8c8e-4cbe-9b03-fef33fd84d52', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('f0d23fcc-ceac-4879-a4d7-5c96350cda7f', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('e421b539-e545-4f5a-a9a3-61f04926f48c', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('ed69fd84-1de0-4296-b88c-bc94d73492e2', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('5944f9dd-b255-40f0-be00-91b03502eaaf', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('19f3474a-c04d-41bf-b175-c50fd7426d4e', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('9757a5e2-dbaa-4c55-9c8b-c0fecb7ff3b5', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('e6e5790a-aa14-4d9f-a24d-2909c39fb4d9', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('3026f36c-1997-4726-94b4-25ea4514784b', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('06747e2a-3e79-4f77-b79c-3fdb7e826380', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('525a34da-39d1-4c6a-8b7f-bbc8b07d9e96', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('38f7dbe8-d7c3-478e-b2f7-d796fda3ed8b', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('dcf2a398-af0f-4303-8023-a70e8610ebc1', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('3ff67ca1-f376-4a01-9329-baddce7015f8', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('0a6b732b-cadd-4da8-ad7d-c46cc4127a2b', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('5933644b-00e1-4cd8-9979-434584cf3441', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('409e126d-c4d2-46d1-9fde-746def75e172', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('51f264f5-b23d-4a92-aace-078e777b7810', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('becfd97b-a20b-42ed-a353-558405d5f173', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('e1b61eb2-e144-4500-aed3-27c94579e5a5', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('c27475e0-92bf-4990-9a25-3065328905b3', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('e8906b95-49c6-4633-af3a-04aad8646d43', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('f3bb8c6c-01c0-48e2-a2dd-81545204f1b9', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('13b22630-6d80-4b9c-93dc-499f13d9dae8', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('eafaf2aa-8e95-4d8c-b11e-eaf70d3f400d', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('83e278bf-ece5-44dc-a403-b1636c8b3585', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('4294589b-493c-48a6-9c68-dc8dfe680d3d', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('2ef890ae-1bf2-4199-8c4a-39caf4498f89', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('eebddcef-fc1c-4744-8ab2-a61aa85b0848', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('b74ffef4-adfb-49bb-b422-bcfd6428c050', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('821e4b65-c25a-4622-a766-ed4ce5fff4b9', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('9f7e09a9-46bd-4a1f-99d4-562999f82c86', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('7bf33ca5-fdd4-41f1-9485-023672d94651', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('928b7da7-7149-49ea-a554-f1249fa3571a', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('64d1fe12-45ef-49fb-8e0b-059314b4a34f', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('f9e439ad-fb5a-4662-884a-7522bd65793a', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('d904dc05-5b92-4c92-b130-b79a91e0e31a', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('02f8ce58-71b9-4b98-a210-24a86a2aec24', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('fa8c37cf-4b2d-4155-8bfb-6ee34e88513e', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('7945b773-8e37-41d3-b70f-292fec3cbc3a', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('b2e84d8b-e512-4e54-a960-f58be7f398f1', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('dc5f3f17-9da3-43ae-b615-78a0cb4516b1', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('e29f1c0d-6cd5-4020-b02b-28cbd7192c32', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('47960c0f-8314-4774-a496-bf3516b47d29', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('c92c796b-1faa-474e-9640-b2c6be4878ed', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('74b09f67-8520-415a-a882-35bb39f62c95', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('fb2ae413-1323-4f2c-a762-b6ef96cacc38', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('2108d981-58fb-4e87-94a2-ea96f0443747', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('f70fb20f-7544-45f2-ada8-c22e2459e43e', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('53afcfc1-d55a-49af-a01d-a9851be4eef0', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('b86b773a-bb22-4e73-92ad-a590f35c7c2a', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('312de389-fa09-473b-9471-a2372e7c96d4', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('1155c96c-6abb-45fe-8078-0a8067bb4911', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('ae2e87f7-30d5-4bf7-9ddc-15acb6f9f6ed', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('26475527-21d7-4ef2-920e-7f6ef295aff7', '7209f83b-e73f-4fe7-87b4-bb13a0e490e6'),
  ('80f219e9-f899-4476-8dd2-9aef1dafaf68', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('b2167ff7-3e8a-4d09-b331-2fb20daedc80', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('8fe0507a-c6f8-4665-baec-5a4ee8314d2c', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('00164726-24b8-40d5-a4a2-fb8522c05a8c', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('50bab843-6ee8-4720-875c-58630c58a7ba', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('0e9c2b0a-7e97-4b83-8236-dec893350702', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('41631e86-8a64-407b-b6fb-1c3f7988f306', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('4221043d-d1a0-4148-9c14-41441e6065f4', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('21b5a0d1-5dd1-4c8f-8fe3-97e5658592c2', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('cd9b1b71-7324-42b1-b6d1-b4aa247a4130', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('ca567269-7a6b-4f28-b128-eadf9152613a', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('fdddfbe6-dd3b-4d8f-8a19-8bdae6ff7db6', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('1bd3e2f7-a5a2-499a-97c6-60f8b74b68ee', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('bd985d6b-c534-41cf-9266-f3d1d33287a2', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('af06306f-fb30-4094-9c6b-4bf7b278c05a', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('571059d1-2418-4597-bca7-38822ef5ae8c', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('1fb66a61-6027-4617-bbb8-5d6e51b9de4b', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('fc053595-55ca-4b15-9fa6-70f5c4a6e842', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('2c6b8e86-43cc-4eb2-833f-7d4395523dcd', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('8b5a7394-885e-47f5-9b49-bbe3dde40671', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('9eae91e1-b7d1-46be-be9e-db01519676da', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('c97fe4ec-fc0a-4201-964a-1c3036c43b16', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('6a34b2dd-310c-4db3-be71-3643f83ff32b', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('b8ace0e8-c6b5-4476-ac6e-ae869ea6d54e', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('fd1816ad-aac6-4d23-981a-79c9d3da0155', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('3644fb82-0ddc-45e9-a48d-dada4980ed9d', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('4a0dd2b0-c15b-46c2-ae96-7da9046a25fc', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('93822857-e3a4-496d-aa2a-b9b653a83f42', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('b282ad10-def4-4fc8-b91a-b6f69f1471e0', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('14fb2f12-04eb-4e35-a113-566ba619f6c4', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('972ae590-67ec-42f0-b43a-0d39e71c2d32', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('55db2b30-82dc-4368-a4cd-4481e8ee102c', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('ad520eec-95a8-44aa-90e5-ce123595ca5d', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('52622334-9e1c-4c86-9790-6f5aa790de8a', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('e4ddde90-42d8-435f-895b-c12493b92b95', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('bcc6cd01-f32c-4e08-921b-f7d12cbb5c01', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('b8ec1975-5da6-429a-a0c7-1adf6e25e8f9', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('e2e2ed8f-96f9-4c49-96f1-779601c28476', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('c96f989c-28f8-421e-acdb-d1543252b014', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('bb28a8af-f01d-4296-b1d4-9c53cfa69b97', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('6651d2e9-63f5-4a8d-9969-c9190b2a54e2', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('f0771a59-f838-4010-8bd1-206aea91c3aa', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('548fd532-9fb4-4bad-873e-ea978a656a6d', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('8953c127-8fa9-4f1e-ae20-d652bcc19b1d', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('aee428c8-a53d-406e-959f-e63a79d95960', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('c18f833c-288e-4cd5-b263-6df2dfa94489', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('3edef261-1271-4f1f-a5e8-e30d2eeead23', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('e70ad9f7-a4b1-4453-a1ff-a01a0155e2b8', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('1c221535-0eb3-465b-97f5-5063e64b645d', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('92ae2b17-0068-422a-9082-47c540aa639a', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('d2010da3-34e3-4888-a208-22c70bc8f5b5', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('57ae8ce2-ee2d-4e09-82b7-dbdd68b9da6e', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('d57cbe14-cd38-45a9-a5a6-20f4cbd4dfb8', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('fdb77a96-6ae0-4dfa-9a3d-4d75293ac3bd', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('d2f5dc6a-3f12-4013-9a49-29f3a13231be', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('d450bc7f-87e7-41f9-8d4c-266cc4e7e753', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('9dd53ced-5418-41c4-bf78-aa93ae630762', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('bf322724-e183-4110-953e-d205744ec6a0', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('b4dea126-9805-4baa-929a-541ddeb62064', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('365437ec-a223-4c5c-a401-96558f682259', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('34c1d9a7-4d2c-428e-ab7f-0c4a93e9c3a7', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('70f83a4a-85fa-4a22-ad29-7792d66cbc0d', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('23e99dc0-c202-4f9f-9c76-e4d42719c69a', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('6cb8ab1d-fb15-4135-8d58-5b450bb6041d', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('6b36c88c-4538-482c-87c6-a742fcf7ba2b', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('b3edf779-4fe7-4b5f-90a4-1c16cd9d2e91', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('f92e148a-c0de-4793-85ce-6fad81423006', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('b774a467-c7c2-406f-be90-986d8c706b92', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('3449f1fb-7319-47ac-bc6d-d77452059099', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('cb8bc1b1-e60c-4f9e-b682-db635e4851df', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('46628df5-d6af-44d4-beba-35280e811741', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('4a80e237-3bdd-42ff-bd24-c9219b77dcf9', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('249737cc-46d8-4757-b0a7-400f02d95e6c', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('4f371af7-705b-4e4c-bc63-55b9e57dec0b', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('24d4970f-f7bc-455a-9320-73fb96623b2f', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('62fd832a-024d-4875-abdf-a29902674b58', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('182c5f0c-7d02-424b-8b37-1acd9d7c0328', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('bcbdc917-a335-40f8-b4ac-b7331c92a7dc', '4e1ca00c-b50d-4dd6-9be2-dd70e1f6d551'),
  ('a7c09006-d2fd-44bc-ac1a-072aec6f731d', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('bc12ff9a-0633-4923-bdab-98656cd2986b', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('546395bd-64ef-4ca5-9ba7-681c23441d41', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('ab5606a5-1995-4eb1-b2f9-388c669f6d5a', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('33712a22-b4a3-43ed-af94-43c17407c2f7', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('56279e81-7a17-43ae-8e13-d9ba123f9923', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('f6bfb840-b5ae-44a0-b163-1a5a32b0b163', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('a4f8ce05-a5a3-4de8-a21f-8ee2840461b6', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('eab37460-4d0d-4477-9da4-362bb1162fb1', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('a02a6dcf-f938-4608-8e4c-032b519e9937', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('82ff2d4c-67c9-4d4e-96c3-46bb2a09d320', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('e53e5462-5973-4da6-979a-b37c74c79a03', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('7d0e3350-14d3-4883-8343-984ef8c529cb', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('02834650-5c83-4f20-8fe5-d71d2a91aa40', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('c96793bf-71b6-4d84-be4b-6f04632a9929', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('b2ab93b8-7f61-4fba-abf0-bfb202a0f69b', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('012c4978-8ad6-47cd-8c15-0ddb640e19e2', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('afc1732c-208d-4790-a444-5b6c72fe8ef5', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('8dd4d5a5-bf95-434f-89fc-1b1dd5d44b7e', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('88e62baa-addc-4fbc-85a6-c05e6203dcf7', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('324e6d34-02dc-4453-b788-d8ce1c8d6af7', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('21c077f2-fc1d-4d66-a671-0f7627835fdf', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('e67b6634-0c12-4f98-a32a-bf17e6f5ebb5', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('8b0690e8-b30a-4140-bc90-bc40ded3c2ee', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('9f06123d-4f61-422b-93d8-64863ace17cd', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('97c22cff-96a9-43fe-9775-f206d405bf90', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('2f5a6e8e-05e7-43aa-af07-4c74827a07cd', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('15afc862-f12f-4564-a1ea-f2f7290bba40', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('4298880e-6726-40c9-81ec-fe92021a096f', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('701e27ac-7627-4cd3-887a-96c141a1f43c', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('7892c842-b82f-4e2b-966b-50782cb937f2', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('aad1c451-d089-47b9-87b7-045a3121e287', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('e13dcc27-193e-4221-827a-a589e5c7988c', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('482c862e-e88a-4236-8004-d9d36d206dca', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('0cafbcd8-ab0b-433d-957a-96132c571600', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('3765b558-e9fe-4ae6-a40c-eb01a81e2c83', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7'),
  ('083a8003-034a-41bb-a626-47f42a0ecd0b', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('52dd94bd-82aa-4dd8-8cfe-35bf8a5aa856', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('8ba9cc81-0763-4c3c-806a-d0f274663f82', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('415edc86-edfe-4204-a218-271f7f67efc9', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('4879653e-3917-446c-8369-b4ffa499ad84', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('c73a56b4-751e-4b91-9170-9b698f54e050', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('4a76edff-1ffb-4a33-a903-9465299c55d4', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('a765bc65-fd8c-4ff0-899a-b6a103fd9c61', '5377a59d-8e09-4d56-b993-c1c7205ba8af'),
  ('e9b0805e-ab99-4d88-949f-8d88def1016e', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('10346187-6b3d-417d-8eb7-567ce6017599', '61744d7e-6f64-4bfe-82b0-d4c056aad239'),
  ('2dd1c0f3-c744-45e5-80fb-aeaf8a5bed97', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('ae3d917c-4c2d-499c-b27b-5a1d325e667a', '31b89aa5-b102-40e1-a61f-5b4f6bd2189e'),
  ('c304c8c9-ee3f-4edf-8d5d-cbaca9fb9f81', 'df3ad085-321c-45b5-9054-e6a036d70793'),
  ('a95d2b01-be21-473d-8898-899de7a41656', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('5ce27329-e258-4b3d-84e2-2170c7634b7a', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('6c5c7ed5-5e8d-49fc-92cd-d9a810bee067', 'e9d57407-f89b-467d-b71a-d984a4777905'),
  ('3154ee0c-c458-4bd2-89a4-ca40c5f2af8a', 'a0a4c214-9bdc-47e8-b77b-e3227ac4ecc7');

-- Conteos antes
SELECT count(*) AS mapping_rows FROM h17_created_by_mapping;
SELECT count(*) AS target_rows_currently_null
FROM teachers t
JOIN h17_created_by_mapping m ON m.teacher_id = t.id
WHERE t.created_by IS NULL;
SELECT count(*) AS target_rows_already_with_created_by
FROM teachers t
JOIN h17_created_by_mapping m ON m.teacher_id = t.id
WHERE t.created_by IS NOT NULL;

-- NO EJECUTAR SIN BACKUP Y APROBACION
UPDATE teachers t
SET created_by = m.coordinator_user_id
FROM h17_created_by_mapping m
WHERE t.id = m.teacher_id
  AND t.created_by IS NULL;

-- Conteos despues dentro de la transaccion
SELECT count(*) AS target_rows_still_null_after_update
FROM teachers t
JOIN h17_created_by_mapping m ON m.teacher_id = t.id
WHERE t.created_by IS NULL;
SELECT u.email AS coordinator_email, count(*) AS teachers_assigned_in_transaction
FROM teachers t
JOIN h17_created_by_mapping m ON m.teacher_id = t.id
JOIN app_users u ON u.id = t.created_by
GROUP BY u.email
ORDER BY u.email;

-- ROLLBACK por defecto. Cambiar a COMMIT solo en ventana aprobada, con backup y validacion.
ROLLBACK;
