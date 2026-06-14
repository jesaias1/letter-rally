import { getAchievements, type PlayerStatistics } from '../progress/playerProgress'

interface ProfilePanelProps {
  statistics: PlayerStatistics
}

export function ProfilePanel({ statistics }: ProfilePanelProps) {
  const achievements = getAchievements(statistics)
  return (
    <section className="profile-panel" aria-label="Player statistics and achievements">
      <div className="profile-stats">
        <span><strong>{statistics.seriesWon}</strong> SERIES WINS</span>
        <span><strong>{statistics.validClaims}</strong> VALID CLAIMS</span>
        <span><strong>{statistics.finalWords}</strong> FINISHERS</span>
        <span><strong>{statistics.bestSeriesScore}</strong> BEST SCORE</span>
      </div>
      <div className="achievement-list">
        {achievements.map((achievement) => (
          <span className={achievement.unlocked ? 'achievement achievement--unlocked' : 'achievement'} title={achievement.description} key={achievement.id}>
            {achievement.title}
          </span>
        ))}
      </div>
    </section>
  )
}
