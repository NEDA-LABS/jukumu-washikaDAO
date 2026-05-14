'use client';

export default function SettingsSection() {
  return (
    <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground mb-5">Mipangilio ya Mfumo</h2>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Mipangilio ya Jumla</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border">
              <span className="text-sm text-foreground/60">Kiwango cha Hisa (%)</span>
              <input type="number" defaultValue="30" className="w-20 px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground text-right focus:outline-none focus:border-orange-500/50" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border">
              <span className="text-sm text-foreground/60">Ada ya Mwezi (TSH)</span>
              <input type="number" defaultValue="50000" className="w-32 px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground text-right focus:outline-none focus:border-orange-500/50" />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Arifa</p>
          <div className="space-y-2">
            {['Arifa za barua pepe kwa wanachama wapya', 'Ripoti za kila wiki'].map((label, i) => (
              <label key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-orange-500" />
                <span className="text-sm text-foreground/60">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
          Hifadhi Mabadiliko
        </button>
      </div>
    </div>
  );
}
