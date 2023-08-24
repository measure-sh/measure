/*
insert sample data to events table
*/

insert into events_test_1 (id, resource.session_id, timestamp, body.type, resource.device_name, resource.device_model) values

    (toUUID('a922b7d5-b53a-41f9-ae29-6bb17abca34d'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now(), 'exception', 'samsung', 's23'),
    (toUUID('214f6409-fb1c-4503-b2ab-abd05af33a0a'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now() + 20, 'exception', 'samsung', 's23'),
    (toUUID('846eb14d-a3a1-4908-bfb5-5da7a5279dca'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now() + 25, 'exception', 'samsung', 's23'),
    (toUUID('524bff3c-3691-42a5-b94b-c883ffd6fbf0'), toUUID('3121bcf9-5708-4572-a2a7-7087844f65fe'), now() + 10, 'exception', 'apple', 'iphone 14'),
    (toUUID('f3813b3b-d7ad-4dee-96c0-d241cc00dd74'), toUUID('3121bcf9-5708-4572-a2a7-7087844f65fe'), now() + 26, 'exception', 'apple', 'iphone 14'),
    (toUUID('8507c8e1-bb93-4052-a5f7-642e1c051322'), toUUID('3121bcf9-5708-4572-a2a7-7087844f65fe'), now() + 28, 'exception', 'apple', 'iphone 14'),
    (toUUID('71a4ff5d-a767-420e-b1fe-1fc57eabb81d'), toUUID('49b52292-06c0-498c-8686-b4c92dce0bd2'), today(), 'exception', 'samsung', 'galaxy s');