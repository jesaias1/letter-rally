interface ConfigurationScreenProps {
  message: string
}

export function ConfigurationScreen({ message }: ConfigurationScreenProps) {
  return (
    <main className="start-screen">
      <section className="start-card configuration-card">
        <span className="brand-mark brand-mark--large">LR</span>
        <p className="eyebrow">SUPABASE SETUP REQUIRED</p>
        <h1>One key missing</h1>
        <p>{message}</p>
        <code>VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...</code>
        <p className="configuration-note">Use the Publishable key from Supabase Settings → API Keys. Never use a secret or service-role key here.</p>
      </section>
    </main>
  )
}
