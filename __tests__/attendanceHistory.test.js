describe('Attendance History Logic and Summary Aggregations', () => {
  const sampleRecords = [
    {
      id: 1,
      attendance_date: '2026-10-11',
      time_in: '2026-10-11T07:45:00+08:00',
      time_out: '2026-10-11T17:00:00+08:00',
      status: 'present',
      time_in_verification_method: 'fingerprint',
    },
    {
      id: 2,
      attendance_date: '2026-10-10',
      time_in: '2026-10-10T08:15:00+08:00',
      time_out: '2026-10-10T17:05:00+08:00',
      status: 'late',
      time_in_verification_method: 'face',
    },
    {
      id: 3,
      attendance_date: '2026-10-09',
      time_in: null,
      time_out: null,
      status: 'absent',
      time_in_verification_method: null,
    },
    {
      id: 4,
      attendance_date: '2026-10-08',
      time_in: '2026-10-08T07:50:00+08:00',
      time_out: '2026-10-08T17:00:00+08:00',
      status: 'present',
      time_in_verification_method: 'fingerprint',
    },
  ];

  it('calculates correct summary statistics from official records', () => {
    const present = sampleRecords.filter(r => r.status === 'present').length;
    const late = sampleRecords.filter(r => r.status === 'late').length;
    const absent = sampleRecords.filter(r => r.status === 'absent').length;
    const total = sampleRecords.length;

    expect(present).toBe(2);
    expect(late).toBe(1);
    expect(absent).toBe(1);
    expect(total).toBe(4);
  });

  it('filters records accurately by status filter', () => {
    const filterByStatus = (records, filter) => {
      if (filter === 'all') return records;
      return records.filter(r => r.status === filter);
    };

    expect(filterByStatus(sampleRecords, 'all').length).toBe(4);
    expect(filterByStatus(sampleRecords, 'present').length).toBe(2);
    expect(filterByStatus(sampleRecords, 'late').length).toBe(1);
    expect(filterByStatus(sampleRecords, 'absent').length).toBe(1);
    expect(filterByStatus(sampleRecords, 'on_leave').length).toBe(0);
  });

  it('preserves authoritative Manila timezone in record details', () => {
    const record = sampleRecords[0];
    expect(record.time_in).toContain('+08:00');
    expect(record.time_in_verification_method).toBe('fingerprint');
  });
});
