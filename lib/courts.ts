export type Court = {
  id: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  sports: string[];
};

export const NTU_COURTS: Court[] = [
  {
    id: "src-court-1",
    name: "NTU SRC Court 1",
    shortName: "SRC Court 1",
    latitude: 1.34833,
    longitude: 103.68825,
    sports: ["Basketball", "Volleyball"],
  },
  {
    id: "src-court-2",
    name: "NTU SRC Court 2",
    shortName: "SRC Court 2",
    latitude: 1.34825 ,
    longitude: 103.68839,
    sports: ["Basketball", "Volleyball"],
  },
  {
    id: "src-court-3",
    name: "NTU SRC Court 3",
    shortName: "SRC Court 3",
    latitude: 1.34820,
    longitude: 103.68860,
    sports: ["Basketball", "Volleyball"],
  },
  {
    id: "hall-3-court",
    name: "Hall 3 Court",
    shortName: "Hall 3",
    latitude: 1.3506219,
    longitude: 103.6821252,
    sports: ["Basketball", "Volleyball"],
  },
  {
    id: "hall-7-court",
    name: "Hall 7 Court",
    shortName: "Hall 7",
    latitude: 1.3406114,
    longitude: 103.6809108,
    sports: ["Basketball"],
  },
  {
    id: "nie-courts",
    name: "NIE Courts",
    shortName: "NIE",
    latitude: 1.3491331,
    longitude: 103.6806386,
    sports: ["Badminton", "Basketball", "Volleyball"],
  },
  {
    id: "ntu-field",
    name: "NTU Field",
    shortName: "Field",
    latitude: 1.34920,
    longitude: 103.68860,
    sports: ["Football", "Frisbee"],
  },
  {
    id: "the-wave",
    name: "The Wave",
    shortName: "The Wave",
    latitude: 1.34895,
    longitude: 103.68930,
    sports: ["Frisbee", "Football"],
  },
];

export const NTU_CENTER = {
  latitude: 1.3483,
  longitude: 103.6850,
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

export function findCourt(locationName: string): Court | undefined {
  return NTU_COURTS.find(
    (c) =>
      c.name.toLowerCase() === locationName.toLowerCase() ||
      c.shortName.toLowerCase() === locationName.toLowerCase() ||
      locationName.toLowerCase().includes(c.shortName.toLowerCase())
  );
}