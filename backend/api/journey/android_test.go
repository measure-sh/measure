package journey

import (
	"backend/api/event"
	"backend/api/group"
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/yourbasic/graph"
)

func readEvents(path string) (events []event.EventField, err error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	events = []event.EventField{}
	_ = json.Unmarshal(bytes, &events)
	return
}

var exceptionGroupOne = group.ExceptionGroup{
	ID: "5d41402abc4b2a76b9719d911017c592",
	EventIDs: []uuid.UUID{
		uuid.MustParse("bd10e744-da4b-4685-bd83-fe29e4ac6ed9"),
		uuid.MustParse("bd3aa0e2-13cf-4ccf-9ddb-7b9d4a8cc48e"),
		uuid.MustParse("94bab322-269e-4861-ad1c-84979074d2a8"),
		uuid.MustParse("d365baad-ee74-4384-9171-464a128120d0"),
		uuid.MustParse("d365baad-ee74-4384-9171-464a128120d0"),
		uuid.MustParse("c4cf0ccd-8d90-48bf-bf26-9004d4283632"),
		uuid.MustParse("5e56a02f-30cf-4259-a542-d48dc15fd000"),
		uuid.MustParse("7e9e68e9-fca9-4282-9705-25e463490c05"),
		uuid.MustParse("ad722050-4ce3-4805-9c7c-823d7c15607c"),
		uuid.MustParse("8b8f474e-dcaa-4bd0-8fd6-853c25809b4e"),
		uuid.MustParse("9db74cec-00af-4b54-b6da-2b448565da9f"),
		uuid.MustParse("eb26ec0b-dc25-4859-9cdf-23a584ae443c"),
		uuid.MustParse("de7d0673-615e-410b-9a65-dd55763d9b2c"),
		uuid.MustParse("3df66f42-b753-45f8-bb67-03e76f19e7c3"),
		uuid.MustParse("89855b3a-0b87-4988-94a4-f524568e41b5"),
		uuid.MustParse("60c5d611-e2c0-423e-8d9c-97b7279520df"),
		uuid.MustParse("e951be5f-6725-46c1-a1cd-d89b72da220f"),
		uuid.MustParse("3fac3fbf-1156-4b92-ac75-66e9cc142e20"),
	},
}

var exceptionGroupTwo = group.ExceptionGroup{
	ID: "6e809cbda0732ac4845916a59016f954",
	EventIDs: []uuid.UUID{
		uuid.MustParse("8fe6d874-8066-463c-b895-825d24cbf418"),
		uuid.MustParse("2e8876ab-df6b-4325-b21a-1d04fdb03c2c"),
		uuid.MustParse("82c84a9e-373b-469c-bcfe-5a5485eed70a"),
		uuid.MustParse("aa782688-76e9-446b-b6b3-11feae59a5d1"),
		uuid.MustParse("7155165c-f603-4446-a58a-a0abc899c36b"),
		uuid.MustParse("b8f0190e-ed24-46ec-9d9d-1c6ad68302c0"),
		uuid.MustParse("db08c0ae-bc5e-49cb-9047-71a39b80f535"),
		uuid.MustParse("aa1de332-1502-4b64-9cb5-daefe97e797c"),
		uuid.MustParse("ee10115d-b076-4533-8138-99b6800d5d6a"),
		uuid.MustParse("00805630-9158-4cd4-9e0c-2bf904f8fa5a"),
		uuid.MustParse("c7a73dd1-7f79-444d-8b15-a4f0df448137"),
		uuid.MustParse("537fe968-25e9-4875-8055-73fe0a4adc91"),
		uuid.MustParse("e2196f50-1d0b-44bb-a4f8-6011dec209e6"),
		uuid.MustParse("c2832a21-ffe2-459e-9234-3ec7a1cc5feb"),
		uuid.MustParse("a9b9d960-e57b-4fbf-89d7-965d84d80a04"),
		uuid.MustParse("57e9ae14-ee28-4df5-bded-4ac4b187d7f9"),
		uuid.MustParse("23cfa1ba-9407-457e-8edd-bba060f5ec33"),
		uuid.MustParse("7b9e79ab-fac4-406e-8e92-31e93ef367fd"),
	},
}

var exceptionGroupThree = group.ExceptionGroup{
	ID: "7ce8be0fa3932e840f6a19c2b83e11ae",
	EventIDs: []uuid.UUID{
		uuid.MustParse("8fe6d874-8066-463c-b895-825d24cbf418"),
		uuid.MustParse("02840cca-9025-44ca-88b8-31f87b958319"),
		uuid.MustParse("c72abbeb-97af-437b-a0f0-6f90ca7a47e8"),
		uuid.MustParse("476cf3c6-97fe-496a-a13f-a3af6f2f82fe"),
		uuid.MustParse("7523c0c3-f1e7-4a5a-8f7a-a18c4c95de81"),
		uuid.MustParse("0d811713-3106-400d-a341-d6787174f89f"),
		uuid.MustParse("2c6ec3ea-14a9-43be-b694-6a0dbbac0f60"),
		uuid.MustParse("edd75a4e-26c7-4290-814c-5476de7e3ec9"),
		uuid.MustParse("d5146f22-3143-4976-b3a0-4e42ec64ca79"),
		uuid.MustParse("7bfdc200-1b4d-45b4-b647-91fb2f9f3493"),
		uuid.MustParse("46a9bceb-a4af-4ece-a6eb-835be73eb589"),
		uuid.MustParse("ec3a76cf-3aad-4af4-a4e1-54db2bf168df"),
		uuid.MustParse("ffbcc3eb-1815-4d35-b91d-ea058cad0d98"),
		uuid.MustParse("ef1bc348-846b-482d-9318-80682dc9188d"),
	},
}

var anrGroupOne = group.ANRGroup{
	ID: "a75f2192bae11cb76cdcdada9332bab6",
	EventIDs: []uuid.UUID{
		uuid.MustParse("e8f656b5-65c3-46ad-a03d-0ba777cff13f"),
	},
}

func TestNewJourneyAndroidOne(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	expectedOrder := 4
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "4 [{0 1} {0 2} {0 3}]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	// forward direction
	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 2)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	// reverse direction
	{
		sessionIds := journey.metalut[journey.makeKey(1, 0)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 0)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(3, 0)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	{
		expected := graph.Stats{
			Size:     6,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 0,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}
}

func TestNewJourneyAndroidTwo(t *testing.T) {
	events, err := readEvents("android_events_two.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	expectedOrder := 5
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "5 [(0 1) (1 2) (2 3) (4 0)]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(1, 2)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 3)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(4, 0)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(4, 0)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}

	{
		expected := graph.Stats{
			Size:     4,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 1,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}
}

func TestNewJourneyAndroidThree(t *testing.T) {
	events, err := readEvents("android_events_three.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	expectedOrder := 19
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "19 [{0 1} {0 6} (0 11) {0 12} {0 15} {0 16} {0 17} {0 18} (1 2) (2 3) (2 4) (2 5) (6 7) (6 10) (6 11) (7 8) {7 9} {9 10} (11 12) (12 13) (13 14)]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 5
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("e4cfa50d-7692-401b-89c1-8e2e59872d72"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
			uuid.MustParse("7ba161b2-0187-4098-98de-4c3ef826ec5e"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 6)].Slice()
		expectedLen := 5
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("175f9b4e-33a9-4b37-ab98-ae2ce6d50da1"),
			uuid.MustParse("60d0dfef-f334-4407-a1d6-91e429cd0c3a"),
			uuid.MustParse("c5d386fb-49a2-4566-9609-42e0176534ea"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
		if expected[4] != sessionIds[4] {
			t.Errorf("Expected %v, but got %v", expected[4], sessionIds[4])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 11)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 12)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("a816378a-0741-4a62-9254-8654a8b0f2fc"),
			uuid.MustParse("c1320e60-c97a-42af-b6bc-19fa57846e44"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
			uuid.MustParse("ae4e9895-0282-4ce0-8d60-e3c3b9947697"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 15)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("a816378a-0741-4a62-9254-8654a8b0f2fc"),
			uuid.MustParse("dcb19306-1747-4d55-850c-c2633f444ba4"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	{
		expected := graph.Stats{
			Size:     30,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 5,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}
}

func TestGetEdgeSessionsOne(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	{
		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		got := journey.metalut[journey.makeKey(0, 1)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		got := journey.metalut[journey.makeKey(0, 2)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		got := journey.metalut[journey.makeKey(0, 3)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		got := journey.metalut[journey.makeKey(1, 0)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		got := journey.metalut[journey.makeKey(2, 0)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		got := journey.metalut[journey.makeKey(3, 0)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}
}

func TestGetEdgeSessionsTwo(t *testing.T) {
	events, err := readEvents("android_events_two.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	{
		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		got := journey.metalut[journey.makeKey(0, 1)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		got := journey.metalut[journey.makeKey(1, 2)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		got := journey.metalut[journey.makeKey(2, 3)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}

	{
		expected := []uuid.UUID{
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
		}
		got := journey.metalut[journey.makeKey(4, 0)].Slice()

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v sessions, but got %v", expected, got)
		}
	}
}

func TestGetEdgeSessionsCountOne(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	{
		expected := 4
		got := journey.GetEdgeSessionCount(0, 1)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 3
		got := journey.GetEdgeSessionCount(0, 2)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 2
		got := journey.GetEdgeSessionCount(0, 3)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 4
		got := journey.GetEdgeSessionCount(1, 0)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 3
		got := journey.GetEdgeSessionCount(2, 0)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 2
		got := journey.GetEdgeSessionCount(3, 0)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}
}

func TestGetEdgeSessionsCountTwo(t *testing.T) {
	events, err := readEvents("android_events_two.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	{
		expected := 4
		got := journey.GetEdgeSessionCount(0, 1)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 4
		got := journey.GetEdgeSessionCount(1, 2)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 4
		got := journey.GetEdgeSessionCount(2, 3)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 1
		got := journey.GetEdgeSessionCount(4, 0)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}
}

func TestGetNodeName(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	expected := "sh.measure.sample.ExceptionDemoActivity"
	got := journey.GetNodeName(0)

	if expected != got {
		t.Errorf("Expected %s node name, but got %s", expected, got)
	}
}

func TestExceptionGroupAccessors(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	groupOne := group.ExceptionGroup{
		ID:         "ebde9cc9540087b9688fdb470fa20f17",
		Type:       "some type",
		Message:    "some message",
		MethodName: "some method name",
		FileName:   "some file name",
		LineNumber: 0,
		EventIDs: []uuid.UUID{
			uuid.MustParse("bd10e744-da4b-4685-bd83-fe29e4ac6ed9"),
			uuid.MustParse("5e56a02f-30cf-4259-a542-d48dc15fd000"),
		},
	}

	expectedLen := 0
	gotLen := len(journey.GetNodeExceptionGroups("sh.measure.sample.ExceptionDemoActivity"))

	if expectedLen != gotLen {
		t.Errorf("Expected %d exception groups, but got %d", expectedLen, gotLen)
	}

	_ = journey.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		return []group.ExceptionGroup{groupOne}, nil
	})

	expectedLen = 1
	gotLen = len(journey.GetNodeExceptionGroups("sh.measure.sample.ExceptionDemoActivity"))

	if expectedLen != gotLen {
		t.Errorf("Expected %d exception groups, but got %d", expectedLen, gotLen)
	}
}

func TestANRGroupAccessors(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	groupOne := group.ANRGroup{
		ID:         "5726012822477f24fe999a1f7223c82a",
		Type:       "some type",
		Message:    "some message",
		MethodName: "some method name",
		FileName:   "some file name",
		LineNumber: 0,
		EventIDs: []uuid.UUID{
			uuid.MustParse("bd10e744-da4b-4685-bd83-fe29e4ac6ed9"),
			uuid.MustParse("5e56a02f-30cf-4259-a542-d48dc15fd000"),
		},
	}

	expectedLen := 0
	gotLen := len(journey.GetNodeANRGroups("sh.measure.sample.ExceptionDemoActivity"))

	if expectedLen != gotLen {
		t.Errorf("Expected %d exception groups, but got %d", expectedLen, gotLen)
	}

	_ = journey.SetNodeANRGroups(func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error) {
		return []group.ANRGroup{groupOne}, nil
	})

	expectedLen = 1
	gotLen = len(journey.GetNodeANRGroups("sh.measure.sample.ExceptionDemoActivity"))

	if expectedLen != gotLen {
		t.Errorf("Expected %d exception groups, but got %d", expectedLen, gotLen)
	}
}

func TestGetNodeVertices(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	expected := []int{0, 1, 2, 3}
	got := journey.GetNodeVertices()

	if !reflect.DeepEqual(expected, got) {
		t.Errorf("Expected %v node vertices, but got %v", expected, got)
	}
}

func TestNewJourneyAndroidBigraphOne(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: false,
	})

	expectedOrder := 4
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "4 [(0 1) (0 2) (0 3)]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	// forward direction
	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 2)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	// reverse direction
	{
		expected := false
		got := journey.Graph.Edge(1, 0)
		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
	{
		expected := false
		got := journey.Graph.Edge(2, 0)
		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestNewJourneyAndroidExceptionsOne(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph:        true,
		ExceptionGroup: &exceptionGroupOne,
	})

	if err := journey.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		exceptionGroups = []group.ExceptionGroup{exceptionGroupOne}
		return
	}); err != nil {
		panic(err)
	}

	expectedOrder := 4
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "4 [{0 1} {0 2} {0 3}]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	// forward direction
	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 2)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	// reverse direction
	{
		sessionIds := journey.metalut[journey.makeKey(1, 0)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 0)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(3, 0)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	{
		expected := graph.Stats{
			Size:     6,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 0,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}

	{
		expected := 6
		got := journey.GetNodeExceptionCount(0, exceptionGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(1, exceptionGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(2, exceptionGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(3, exceptionGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}
}

func TestNewJourneyAndroidExceptionsTwo(t *testing.T) {
	events, err := readEvents("android_events_two.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph:        true,
		ExceptionGroup: &exceptionGroupTwo,
	})

	if err := journey.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		exceptionGroups = []group.ExceptionGroup{exceptionGroupTwo}
		return
	}); err != nil {
		panic(err)
	}

	expectedOrder := 5
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "5 [(0 1) (1 2) (2 3) (4 0)]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(1, 2)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 3)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("4339f2be-ec13-4858-9b7f-322e5ddf55f4"),
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
			uuid.MustParse("1755de51-18c8-4c14-a58d-ad677485130e"),
			uuid.MustParse("bcafd264-43eb-433b-8851-00306ecc2706"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(4, 0)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(4, 0)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("65aaf877-e000-4ff3-9f8f-a0dbb10e9b00"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}

	{
		expected := graph.Stats{
			Size:     4,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 1,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}

	{
		expected := 18
		got := journey.GetNodeExceptionCount(0, exceptionGroupTwo.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(1, exceptionGroupTwo.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(2, exceptionGroupTwo.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(3, exceptionGroupTwo.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(4, exceptionGroupTwo.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}
}

func TestNewJourneyAndroidExceptionsThree(t *testing.T) {
	events, err := readEvents("android_events_three.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph:        true,
		ExceptionGroup: &exceptionGroupThree,
	})

	if err := journey.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		exceptionGroups = []group.ExceptionGroup{exceptionGroupThree}
		return
	}); err != nil {
		panic(err)
	}

	expectedOrder := 19
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "19 [{0 1} {0 6} (0 11) {0 12} {0 15} {0 16} {0 17} {0 18} (1 2) (2 3) (2 4) (2 5) (6 7) (6 10) (6 11) (7 8) {7 9} {9 10} (11 12) (12 13) (13 14)]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 5
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("e4cfa50d-7692-401b-89c1-8e2e59872d72"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
			uuid.MustParse("7ba161b2-0187-4098-98de-4c3ef826ec5e"),
			uuid.MustParse("9df333bb-24b5-4f83-a5b8-850c750ed934"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
		if expected[4] != sessionIds[4] {
			t.Errorf("Expected %v, but got %v", expected[4], sessionIds[4])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(1, 2)].Slice()
		expectedLen := 5
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("e4cfa50d-7692-401b-89c1-8e2e59872d72"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
			uuid.MustParse("7ba161b2-0187-4098-98de-4c3ef826ec5e"),
			uuid.MustParse("9df333bb-24b5-4f83-a5b8-850c750ed934"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
		if expected[4] != sessionIds[4] {
			t.Errorf("Expected %v, but got %v", expected[4], sessionIds[4])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 3)].Slice()
		expectedLen := 5
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("e4cfa50d-7692-401b-89c1-8e2e59872d72"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
			uuid.MustParse("7ba161b2-0187-4098-98de-4c3ef826ec5e"),
			uuid.MustParse("9df333bb-24b5-4f83-a5b8-850c750ed934"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
		if expected[4] != sessionIds[4] {
			t.Errorf("Expected %v, but got %v", expected[4], sessionIds[4])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 4)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("e4cfa50d-7692-401b-89c1-8e2e59872d72"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(1, 0)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("26f4ebd0-7866-47fc-a045-25b1ebaa0f49"),
			uuid.MustParse("b1eb8d33-bacb-475d-8587-09efaae497f4"),
			uuid.MustParse("7ba161b2-0187-4098-98de-4c3ef826ec5e"),
			uuid.MustParse("9df333bb-24b5-4f83-a5b8-850c750ed934"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		expected := graph.Stats{
			Size:     30,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 5,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}

	{
		expected := 6
		got := journey.GetNodeExceptionCount(0, exceptionGroupThree.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 2
		got := journey.GetNodeExceptionCount(1, exceptionGroupThree.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(2, exceptionGroupThree.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(3, exceptionGroupThree.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeExceptionCount(4, exceptionGroupThree.ID)

		if expected != got {
			t.Errorf("Expected %d node exceptions, but got %d", expected, got)
		}
	}
}

func TestNewJourneyAndroidANRsOne(t *testing.T) {
	events, err := readEvents("android_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph:  true,
		ANRGroup: &anrGroupOne,
	})

	if err := journey.SetNodeANRGroups(func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error) {
		anrGroups = []group.ANRGroup{anrGroupOne}
		return
	}); err != nil {
		panic(err)
	}

	expectedOrder := 4
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "4 [{0 1} {0 2} {0 3}]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	// forward direction
	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 2)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	// reverse direction
	{
		sessionIds := journey.metalut[journey.makeKey(1, 0)].Slice()
		expectedLen := 4
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("58e94ae9-a084-479f-9049-2c5135f6090f"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
		if expected[3] != sessionIds[3] {
			t.Errorf("Expected %v, but got %v", expected[3], sessionIds[3])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(2, 0)].Slice()
		expectedLen := 3
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("a3d629f5-6bab-4a43-8e75-fa5d6b539d33"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
		if expected[2] != sessionIds[2] {
			t.Errorf("Expected %v, but got %v", expected[2], sessionIds[2])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(3, 0)].Slice()
		expectedLen := 2
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("9e44aa3a-3d67-4a56-8a76-a9fff7e2aae9"),
			uuid.MustParse("460765ab-1834-454e-b207-d8235b2160d9"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
		if expected[1] != sessionIds[1] {
			t.Errorf("Expected %v, but got %v", expected[1], sessionIds[1])
		}
	}

	{
		expected := graph.Stats{
			Size:     6,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 0,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}

	{
		expected := 1
		got := journey.GetNodeANRCount(0, anrGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node ANRs, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeANRCount(1, anrGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node ANRs, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeANRCount(2, anrGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node ANRs, but got %d", expected, got)
		}
	}

	{
		expected := 0
		got := journey.GetNodeANRCount(3, anrGroupOne.ID)

		if expected != got {
			t.Errorf("Expected %d node ANRs, but got %d", expected, got)
		}
	}
}
