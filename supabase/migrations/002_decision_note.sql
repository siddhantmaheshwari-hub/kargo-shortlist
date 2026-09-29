-- Records why Arjun advanced or passed a candidate (pre-filled from the scorecard, editable).
alter table candidates add column if not exists decision_note text;
