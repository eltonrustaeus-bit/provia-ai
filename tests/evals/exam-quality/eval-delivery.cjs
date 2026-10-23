function decideFirstPass(question, outcome, decideVerifier, decideSolver) {
  if (!outcome.verifierCallOk) {
    return { approved: false, verifierRejected: false, solverRejected: false, solverReason: null, solverChecked: false };
  }

  const verifierOk = !!(outcome.verifierResult && decideVerifier(outcome.verifierResult));
  if (!verifierOk) {
    return { approved: false, verifierRejected: true, solverRejected: false, solverReason: null, solverChecked: false };
  }

  if (question.type !== "mc" || !outcome.solverEnabled) {
    return { approved: true, verifierRejected: false, solverRejected: false, solverReason: null, solverChecked: false };
  }

  if (!outcome.solverCallOk) {
    return { approved: false, verifierRejected: false, solverRejected: true, solverReason: "solver_unavailable", solverChecked: true };
  }

  const decision = decideSolver(outcome.solverResult, question);
  return {
    approved: !!decision.keep,
    verifierRejected: false,
    solverRejected: !decision.keep,
    solverReason: decision.keep ? null : decision.reason,
    solverChecked: true,
  };
}

module.exports = { decideFirstPass };
