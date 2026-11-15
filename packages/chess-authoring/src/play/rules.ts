/** Trial economy is explicit data, independent of authored unit content and host accounts. */
export const trialRules = {
  startHealth: 30,
  startGold: 10,
  income: 5,
  interestPerGold: 10,
  maxInterest: 5,
  refreshCost: 2,
  shopSize: 5,
  benchSize: 9,
  startLevel: 3,
  maxLevel: 8,
  upgradeCost: 4,
  upgradeXp: 4,
  roundXp: 2,
  xpToLevel: [0, 2, 2, 6, 10, 18, 30, 46],
  shopWeights: [40, 30, 18, 9, 3],
  maxRounds: 30,
  lossBase: 2,
  lossPerSurvivor: 1,
} as const;
export type TrialRules = typeof trialRules;
