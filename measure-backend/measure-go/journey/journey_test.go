package journey

import (
	"encoding/json"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/group"
	"os"
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/yourbasic/graph"
)

func readEvents(path string) (events []event.EventField, err error) {
	bytes, err := os.ReadFile(path)
	events = []event.EventField{}
	json.Unmarshal(bytes, &events)
	return
}

var exceptionGroupOne = group.ExceptionGroup{
	ID: uuid.MustParse("018fba31-0012-7274-8874-8b062b9f6690"),
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
	ID: uuid.MustParse("018fba30-637d-7367-85b6-0b375e16f5a2"),
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

var anrGroupOne = group.ANRGroup{
	ID: uuid.MustParse("018fba31-08cc-7d93-9c26-1c3a5226abaa"),
	EventIDs: []uuid.UUID{
		uuid.MustParse("e8f656b5-65c3-46ad-a03d-0ba777cff13f"),
	},
}

func TestNewJourneyAndroidOne(t *testing.T) {
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_two.json")
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

	expectedString := "5 [(0 1) (0 2) (0 3) (4 0)]"
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
		sessionIds := journey.metalut[journey.makeKey(0, 2)].Slice()
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
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
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
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
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
		expected := graph.Stats{
			Size:     4,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 3,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}
}

func TestGetEdgeSessionsOne(t *testing.T) {
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_two.json")
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
		got := journey.metalut[journey.makeKey(0, 2)].Slice()

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
		got := journey.metalut[journey.makeKey(0, 3)].Slice()

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
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_two.json")
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
		got := journey.GetEdgeSessionCount(0, 2)

		if expected != got {
			t.Errorf("Expected %d session count, but got %v", expected, got)
		}
	}

	{
		expected := 4
		got := journey.GetEdgeSessionCount(0, 3)

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
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	groupOne := group.ExceptionGroup{
		ID:   uuid.MustParse("b863efbe-585e-4e14-856d-fe6a3f31b64e"),
		Name: "some bla bla exception one",
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

	journey.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		return []group.ExceptionGroup{groupOne}, nil
	})

	expectedLen = 1
	gotLen = len(journey.GetNodeExceptionGroups("sh.measure.sample.ExceptionDemoActivity"))

	if expectedLen != gotLen {
		t.Errorf("Expected %d exception groups, but got %d", expectedLen, gotLen)
	}
}

func TestANRGroupAccessors(t *testing.T) {
	events, err := readEvents("events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyAndroid(events, &Options{
		BiGraph: true,
	})

	groupOne := group.ANRGroup{
		ID:   uuid.MustParse("b863efbe-585e-4e14-856d-fe6a3f31b64e"),
		Name: "some bla bla anr one",
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

	journey.SetNodeANRGroups(func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error) {
		return []group.ANRGroup{groupOne}, nil
	})

	expectedLen = 1
	gotLen = len(journey.GetNodeANRGroups("sh.measure.sample.ExceptionDemoActivity"))

	if expectedLen != gotLen {
		t.Errorf("Expected %d exception groups, but got %d", expectedLen, gotLen)
	}
}

func TestGetNodeVertices(t *testing.T) {
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_one.json")
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
	events, err := readEvents("events_two.json")
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

	expectedString := "5 [(0 1) (0 2) (0 3) (4 0)]"
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
		sessionIds := journey.metalut[journey.makeKey(0, 2)].Slice()
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
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
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
		sessionIds := journey.metalut[journey.makeKey(0, 3)].Slice()
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
		expected := graph.Stats{
			Size:     4,
			Multi:    0,
			Weighted: 0,
			Loops:    0,
			Isolated: 3,
		}
		got := graph.Check(journey.Graph)

		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v graph stats, but got %v", expected, got)
		}
	}

	{
		expected := 0
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
		expected := 18
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

func TestNewJourneyAndroidANRsOne(t *testing.T) {
	events, err := readEvents("events_one.json")
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
