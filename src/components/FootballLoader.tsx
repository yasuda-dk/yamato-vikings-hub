export function FootballLoader() {
  return (
    <div className="football-loader" aria-hidden="true" data-testid="football-loader">
      <img className="football-loader__portrait" src={`${import.meta.env.BASE_URL}brand/loading-portrait.webp`} alt="" width="144" height="180" decoding="async" fetchPriority="low" />
      <img className="football-loader__ball" src={`${import.meta.env.BASE_URL}brand/loading-football.webp`} alt="" width="44" height="44" decoding="async" fetchPriority="low" />
    </div>
  );
}
