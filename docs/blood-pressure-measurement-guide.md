# Blood-pressure measurement guide

## Product purpose

The web form presents a short, visible checklist before the blood-pressure fields to help users record observations under more consistent conditions. It is a record-quality aid only.

The checklist covers:

- avoiding caffeine, smoking, and exercise for 30 minutes before measuring, and emptying the bladder;
- five minutes of quiet rest with supported back, feet on the floor, and uncrossed legs;
- placing the cuff on a bare upper arm, supporting the arm at heart level, and avoiding talking or phone use while measuring.

The UI keeps the existing morning/evening period selector and asks users to record at a similar time when possible.

## Boundary

- This guide is not persisted and does not affect the observation payload, API, database, RLS policy, retention, model input, or export.
- It does not classify readings or provide diagnosis, treatment, prevention, or emergency guidance.
- The service does not verify that a user followed the checklist.

## Source

The wording is a concise Korean adaptation of the preparation and positioning instructions in the [American Heart Association home blood-pressure monitoring guide](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home), accessed 2026-09-03.
