import * as THREE from "three";

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** VW embléma (króm kör, V/W) */
export function vwLogo(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, "#f8fafc");
    grad.addColorStop(0.5, "#94a3b8");
    grad.addColorStop(1, "#e2e8f0");
    g.strokeStyle = grad;
    g.lineWidth = 16;
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(15,23,42,0.85)";
    g.beginPath();
    g.arc(128, 128, 104, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 14;
    g.lineJoin = "miter";
    g.beginPath(); // V
    g.moveTo(78, 52);
    g.lineTo(128, 150);
    g.lineTo(178, 52);
    g.stroke();
    g.beginPath(); // W
    g.moveTo(40, 92);
    g.lineTo(88, 212);
    g.lineTo(128, 130);
    g.lineTo(168, 212);
    g.lineTo(216, 92);
    g.stroke();
  });
}

/** „R” embléma */
export function rBadge(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    const grad = g.createLinearGradient(0, 40, 0, 220);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#94a3b8");
    grad.addColorStop(1, "#e5e7eb");
    g.fillStyle = grad;
    g.font = "italic 900 210px Arial, Helvetica, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("R", 128, 134);
    g.fillStyle = "#1d4ed8";
    g.fillRect(52, 222, 160, 10);
  });
}

/** Magyar rendszámtábla (EU sáv) */
export function plate(text: string): THREE.CanvasTexture {
  return canvasTexture(520, 112, (g, w, h) => {
    g.fillStyle = "#f8fafc";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#111";
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = "#1e40af";
    g.fillRect(6, 6, 58, h - 12);
    g.fillStyle = "#facc15";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.arc(35 + Math.cos(a) * 17, 38 + Math.sin(a) * 17, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#fff";
    g.font = "bold 30px Arial";
    g.textAlign = "center";
    g.fillText("H", 35, 92);
    g.fillStyle = "#111";
    g.font = "bold 78px 'DIN Alternate', Arial, sans-serif";
    g.textBaseline = "middle";
    g.fillText(text, 290, 60);
  });
}

/** Aszfalt / beton lap textúra világkoordinátás csempézéshez */
export function asphalt(): THREE.CanvasTexture {
  const t = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#3a3d42";
    g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 34;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = "rgba(20,20,22,0.55)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2, h);
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Gumi oldalfal felirat */
export function tyreWall(): THREE.CanvasTexture {
  const t = canvasTexture(1024, 64, (g, w, h) => {
    g.fillStyle = "#151517";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3f3f46";
    g.font = "bold 30px Arial";
    g.textBaseline = "middle";
    for (let k = 0; k < 2; k++) g.fillText("PIRELLI  P ZERO   235/35 ZR19 91Y   ", k * 512 + 10, h / 2);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
