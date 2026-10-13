export const MIN_INSIGHT_COHORT = 5;

export function summarizeClassForInsight(students) {
  const cohort = (Array.isArray(students) ? students : []).filter((student) =>
    Number(student?.tests_taken) > 0 && student?.avg_percent != null
      && Number.isFinite(Number(student.avg_percent))
      && Number(student.avg_percent) >= 0 && Number(student.avg_percent) <= 100
  );
  if (cohort.length < MIN_INSIGHT_COHORT) {
    return { ready: false, students_with_data: cohort.length, class_avg: null, top_weak: [] };
  }

  const conceptCounts = new Map();
  for (const student of cohort) {
    const uniqueConcepts = new Set((Array.isArray(student.weak_concepts) ? student.weak_concepts : [])
      .map((item) => String(item?.concept || "").trim().slice(0, 60))
      .filter(Boolean));
    for (const concept of uniqueConcepts) conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
  }

  const average = cohort.reduce((sum, student) => sum + Number(student.avg_percent), 0) / cohort.length;
  return {
    ready: true,
    students_with_data: cohort.length,
    class_avg: Math.round(average / 10) * 10,
    top_weak: [...conceptCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sv"))
      .slice(0, 5)
      .map(([concept, count]) => ({ concept, students: count })),
  };
}
