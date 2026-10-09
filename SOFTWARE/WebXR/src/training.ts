// Firmware reference: SOFTWARE/Arduino/maasi/maasi.ino.
// Lid/sample checks are training rules, not firmware interlocks.
export type Phase = 'idle' | 'dispensing' | 'rampup' | 'coating' | 'rampdown';
export type Action = 'lid' | 'sample' | 'drop' | 'start' | 'coat' | 'stop' | 'rpmDown' | 'rpmUp' | 'timeDown' | 'timeUp';

export const steps = [
  ['蓋を開ける', '装置の蓋を選択して開きます。'],
  ['試料を設置する', '試料を選択してホルダーに設置します。'],
  ['条件を確認する', '回転数と塗布時間を確認し、STARTを押します。初期設定は3,000 RPM / 30秒です。'],
  ['液体を滴下する', '600 RPMの滴下用回転中に、ピペットを選択して滴下します。'],
  ['蓋を閉じる', '滴下が終わったら蓋を閉じます。'],
  ['塗布を開始する', 'COATを押すと、加速 → 塗布 → 減速の順に進みます。'],
  ['停止を待つ', '回転数が0 RPMになるまで待ちます。STOPは練習を中断して減速します。'],
  ['試料を回収する', '停止したら蓋を開け、試料を選択して回収します。'],
  ['練習完了', '設置から塗布、回収まで完了しました。リセットして繰り返し練習できます。'],
] as const;

export class Training {
  phase: Phase = 'idle';
  lidOpen = false;
  sampleLoaded = false;
  dropped = false;
  finished = false;
  complete = false;
  coatRPM = 3000;
  coatSeconds = 30;
  rpm = 0;
  elapsed = 0;
  film = 0;
  feedback = '蓋を開けて練習を始めましょう。';
  private rampStartRPM = 0;
  private successfulRun = false;

  get step(): number {
    if (this.complete) return 8;
    if (this.finished) return 7;
    if (['rampup', 'coating', 'rampdown'].includes(this.phase)) return 6;
    if (!this.sampleLoaded) return this.lidOpen ? 1 : 0;
    if (this.phase === 'idle') return 2;
    if (!this.dropped) return 3;
    return this.lidOpen ? 4 : 5;
  }

  get remaining(): number | null {
    if (this.phase === 'rampup') return Math.max(0, 3 - this.elapsed);
    if (this.phase === 'coating') return Math.max(0, this.coatSeconds - this.elapsed);
    if (this.phase === 'rampdown') return Math.max(0, 1.5 - this.elapsed);
    return null;
  }

  reason(action: Action): string | null {
    const running = this.phase !== 'idle';
    if (this.complete) return '練習完了です。リセットしてもう一度練習できます。';
    switch (action) {
      case 'lid':
        if (['rampup', 'coating', 'rampdown'].includes(this.phase)) return '回転が完全に停止してから蓋を開けます。';
        if (this.phase === 'dispensing' && !this.lidOpen) return '蓋を閉じた後は、STOPで停止してから開けます。';
        return null;
      case 'sample':
        if (running) return '試料の設置・回収は停止中に行います。';
        if (!this.lidOpen) return '先に蓋を開けます。';
        return null;
      case 'drop':
        if (this.phase !== 'dispensing') return 'STARTで滴下用回転を開始してから滴下します。';
        if (!this.lidOpen) return '滴下するには蓋を開けておきます。';
        if (this.dropped) return '滴下済みです。蓋を閉じてCOATを押します。';
        return null;
      case 'start':
        if (running) return '運転中です。停止してから開始します。';
        if (this.finished) return '塗布済みの試料を回収してください。';
        if (!this.sampleLoaded) return '先に試料をホルダーに設置します。';
        if (!this.lidOpen) return '滴下に備えて蓋を開けます。';
        return null;
      case 'coat':
        if (this.phase !== 'dispensing') return '先にSTARTで滴下用回転を開始します。';
        if (!this.dropped) return '先に液体を滴下します。';
        if (this.lidOpen) return '蓋を閉じてから塗布を開始します。';
        return null;
      case 'stop': return running && this.phase !== 'rampdown' ? null : '現在、停止中または減速中です。';
      default:
        if (running) return '条件は停止中に変更します。';
        if (action === 'rpmDown' && this.coatRPM <= 300) return '回転数の下限は300 RPMです。';
        if (action === 'rpmUp' && this.coatRPM >= 8000) return '回転数の上限は8,000 RPMです。';
        if (action === 'timeDown' && this.coatSeconds <= 1) return '塗布時間の下限は1秒です。';
        if (action === 'timeUp' && this.coatSeconds >= 80) return '塗布時間の上限は80秒です。';
        return null;
    }
  }

  act(action: Action): boolean {
    const reason = this.reason(action);
    if (reason) { this.feedback = reason; return false; }
    switch (action) {
      case 'lid': this.lidOpen = !this.lidOpen; break;
      case 'sample':
        this.sampleLoaded = !this.sampleLoaded;
        if (!this.sampleLoaded) {
          this.complete = this.finished;
          this.dropped = false;
          this.film = 0;
        }
        break;
      case 'start':
        this.phase = 'dispensing'; this.rpm = 600; this.elapsed = 0;
        this.successfulRun = false; this.dropped = false; this.film = 0;
        break;
      case 'drop': this.dropped = true; this.film = 0.12; break;
      case 'coat': this.phase = 'rampup'; this.elapsed = 0; break;
      case 'stop':
        this.beginRampdown(false);
        this.feedback = '練習を中断しました。停止後、滴下からやり直せます。';
        return true;
      case 'rpmDown': this.coatRPM -= 100; break;
      case 'rpmUp': this.coatRPM += 100; break;
      case 'timeDown': this.coatSeconds -= 1; break;
      case 'timeUp': this.coatSeconds += 1; break;
    }
    this.feedback = steps[this.step][1];
    return true;
  }

  private beginRampdown(success: boolean) {
    this.rampStartRPM = this.rpm;
    this.successfulRun = success;
    this.phase = 'rampdown'; this.elapsed = 0;
  }

  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Consume overflow at boundaries: one long frame must not skip phases.
    let left = dt;
    while (left > 0 && ['rampup', 'coating', 'rampdown'].includes(this.phase)) {
      const duration = this.phase === 'rampup' ? 3 : this.phase === 'coating' ? this.coatSeconds : 1.5;
      const consumed = Math.min(left, duration - this.elapsed);
      this.elapsed += consumed; left -= consumed;
      const t = Math.min(1, this.elapsed / duration);
      if (this.phase === 'rampup') { this.rpm = 600 + (this.coatRPM - 600) * t; this.film = 0.12 + 0.6 * t; }
      if (this.phase === 'coating') { this.rpm = this.coatRPM; this.film = 0.72 + 0.28 * t; }
      if (this.phase === 'rampdown') this.rpm = this.rampStartRPM * (1 - t);
      if (this.elapsed < duration) break;
      if (this.phase === 'rampup') { this.phase = 'coating'; this.elapsed = 0; }
      else if (this.phase === 'coating') this.beginRampdown(true);
      else {
        this.phase = 'idle'; this.rpm = 0; this.elapsed = 0;
        this.finished = this.successfulRun;
        if (!this.finished) { this.dropped = false; this.film = 0; }
        this.feedback = this.finished ? steps[7][1] : '停止しました。STARTで滴下からやり直せます。';
      }
    }
  }
}
