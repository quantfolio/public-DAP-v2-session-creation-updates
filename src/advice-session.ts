// Friendly facade over the generated advice_session (v2) SDK functions.
// Importing this module ensures the client is configured (auth + base URL).
import "./api.js";

import {
  getV2AdviceSession,
  getV2AdviceSessionBySessionId,
  patchV2AdviceSessionBySessionId,
  getV2AdviceSessionBySessionIdAdviceInformation,
  putV2AdviceSessionBySessionIdAdviceInformation,
  getV2AdviceSessionBySessionIdFinancialSituation,
  putV2AdviceSessionBySessionIdFinancialSituation,
  getV2AdviceSessionBySessionIdGoal,
  postV2AdviceSessionBySessionIdGoal,
  getV2AdviceSessionBySessionIdGoalByGoalId,
  patchV2AdviceSessionBySessionIdGoalByGoalId,
  deleteV2AdviceSessionBySessionIdGoalByGoalId,
  getV2AdviceSessionBySessionIdGoalByGoalIdInformation,
  putV2AdviceSessionBySessionIdGoalByGoalIdInformation,
  getV2AdviceSessionBySessionIdKnowledgeAndExperience,
  putV2AdviceSessionBySessionIdKnowledgeAndExperience,
  getV2AdviceSessionBySessionIdRiskQuestion,
  putV2AdviceSessionBySessionIdRiskQuestion,
  getV2AdviceSessionBySessionIdSustainability,
  putV2AdviceSessionBySessionIdSustainability,
  getV2AdviceSessionBySessionIdTransactions,
} from "./client/sdk.gen.js";

export const adviceSession = {
  // Sessions
  list: getV2AdviceSession,
  get: getV2AdviceSessionBySessionId,
  update: patchV2AdviceSessionBySessionId,

  // Advice information
  getAdviceInformation: getV2AdviceSessionBySessionIdAdviceInformation,
  setAdviceInformation: putV2AdviceSessionBySessionIdAdviceInformation,

  // Financial situation
  getFinancialSituation: getV2AdviceSessionBySessionIdFinancialSituation,
  setFinancialSituation: putV2AdviceSessionBySessionIdFinancialSituation,

  // Goals
  listGoals: getV2AdviceSessionBySessionIdGoal,
  createGoal: postV2AdviceSessionBySessionIdGoal,
  getGoal: getV2AdviceSessionBySessionIdGoalByGoalId,
  updateGoal: patchV2AdviceSessionBySessionIdGoalByGoalId,
  deleteGoal: deleteV2AdviceSessionBySessionIdGoalByGoalId,
  getGoalInformation: getV2AdviceSessionBySessionIdGoalByGoalIdInformation,
  setGoalInformation: putV2AdviceSessionBySessionIdGoalByGoalIdInformation,

  // Suitability inputs
  getKnowledgeAndExperience: getV2AdviceSessionBySessionIdKnowledgeAndExperience,
  setKnowledgeAndExperience: putV2AdviceSessionBySessionIdKnowledgeAndExperience,
  getRiskQuestion: getV2AdviceSessionBySessionIdRiskQuestion,
  setRiskQuestion: putV2AdviceSessionBySessionIdRiskQuestion,
  getSustainability: getV2AdviceSessionBySessionIdSustainability,
  setSustainability: putV2AdviceSessionBySessionIdSustainability,

  // Transactions
  getTransactions: getV2AdviceSessionBySessionIdTransactions,
};
