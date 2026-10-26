export const LEADERBOARD_SMALL_SAMPLE_GAMES = 5;
export const LEADERBOARD_ORDERS = [
  {id:'rate',label:'胜率榜',hint:'先比胜率，同胜率再比胜场。'},
  {id:'wins',label:'累计胜场',hint:'先比累计胜场，同胜场再比胜率。'},
] as const;
export type LeaderboardOrder = typeof LEADERBOARD_ORDERS[number]['id'];
export function leaderboardOrder(value:unknown):LeaderboardOrder {
  if(value===undefined||value==='rate')return 'rate';
  if(value==='wins')return 'wins';
  throw new Error('排行榜 order 请填 rate（胜率）或 wins（累计胜场）');
}
