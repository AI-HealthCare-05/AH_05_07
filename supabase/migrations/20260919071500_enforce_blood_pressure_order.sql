-- Keep the direct authenticated Data API boundary aligned with the FastAPI
-- BloodPressureObservationInput invariant. Existing range checks remain
-- independent; this constraint rejects otherwise in-range inverted/equal pairs.

alter table public.blood_pressure_observations
  add constraint blood_pressure_observations_pressure_order_check
  check (systolic > diastolic);
