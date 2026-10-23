function decideFirstPass(question, outcome, decideVerifier, decideSolver) {
  if (!outcome.verifierCallOk) {
    return { approved: false, verifierRejected: false, solverRejected: false, solverReason: null, solverChecked: false };
  }

  const verifierOk = !!(outcome.verifierResult && decideVerifier(outcome.verifierResult));

  if (question.type !== "mc" || !outcome.solverEnabled) {
    return { approved: verifierOk, verifierRejected: !verifierOk, solverRejected: false, solverReason: null, solverChecked: false };
  }

  if (!outcome.solverCallOk) {
    return { approved: false, verifierRejected: !verifierOk, solverRejected: true, solverReason: "solver_unavailable", solverChecked: true };
  }

  const decision = decideSolver(outcome.solverResult, question);
  return {
    approved: verifierOk && !!decision.keep,
    verifierRejected: !verifierOk,
    solverRejected: !decision.keep,
    solverReason: decision.keep ? null : decision.reason,
    solverChecked: true,
  };
}

module.exports = { decideFirstPass };
