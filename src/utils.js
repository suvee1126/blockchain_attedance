// Generate a fake Ethereum-style transaction hash
export function generateBlockchainHash() {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Generate a shorter display hash
export function shortenHash(hash) {
  if (!hash) return '';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

// Format date
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format time
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate a random USN
export function generateUSN() {
  const year = '22';
  const dept = 'CS';
  const num = String(Math.floor(Math.random() * 200) + 1).padStart(3, '0');
  return `1SI${year}${dept}${num}`;
}

// Haversine formula to calculate distance between two GPS coordinates in meters
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Get current GPS coordinates via browser Geolocation API
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ─── Deep Biometric Face Comparison (Client-Side Standard) ───

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for biometric analysis'));
    img.src = src;
  });
}

function extractFaceBiometricFeatures(img, size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not initialize canvas context for biometric extraction');

  ctx.drawImage(img, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Grayscale & luminance
  const gray = new Float32Array(size * size);
  let sum = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[j] = y;
    sum += y;
  }

  // Mean & standard deviation contrast normalization
  const mean = sum / gray.length;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) {
    const diff = gray[i] - mean;
    variance += diff * diff;
  }
  const std = Math.sqrt(variance / gray.length) || 1;

  const normGray = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    normGray[i] = (gray[i] - mean) / std;
  }

  // 128-dimensional Histogram of Oriented Gradients (HOG: 4x4 blocks, 8 bins)
  const blockSize = Math.floor(size / 4);
  const hog = new Float32Array(16 * 8);

  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      const blockIdx = (by * 4 + bx) * 8;
      const startY = by * blockSize;
      const startX = bx * blockSize;

      for (let y = 1; y < blockSize - 1; y++) {
        const py = startY + y;
        for (let x = 1; x < blockSize - 1; x++) {
          const px = startX + x;
          const idx = py * size + px;

          const dx = normGray[idx + 1] - normGray[idx - 1];
          const dy = normGray[idx + size] - normGray[idx - size];
          const mag = Math.sqrt(dx * dx + dy * dy);
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          const bin = Math.floor(angle / 45) % 8;
          hog[blockIdx + bin] += mag;
        }
      }
    }
  }

  // L2 unit normalization for HOG descriptor
  let hogNorm = 0;
  for (let i = 0; i < hog.length; i++) hogNorm += hog[i] * hog[i];
  hogNorm = Math.sqrt(hogNorm) || 1;
  for (let i = 0; i < hog.length; i++) hog[i] /= hogNorm;

  return { normGray, hog, size };
}

export async function compareFaceBiometricsClientSide(enrolledSrc, liveSrc, threshold = 0.74) {
  if (!enrolledSrc || !liveSrc) {
    return {
      verified: false,
      score: 0,
      matchPercentage: 0,
      error: 'Missing face image for biometric matching'
    };
  }

  try {
    const [enrolledImg, liveImg] = await Promise.all([
      loadImageElement(enrolledSrc),
      loadImageElement(liveSrc)
    ]);

    const feat1 = extractFaceBiometricFeatures(enrolledImg, 96);
    const feat2 = extractFaceBiometricFeatures(liveImg, 96);

    // 1. HOG Cosine Similarity (structure and edge gradient orientation match)
    let hogDot = 0;
    for (let i = 0; i < feat1.hog.length; i++) {
      hogDot += feat1.hog[i] * feat2.hog[i];
    }
    const hogSim = Math.max(0, Math.min(1, hogDot));

    // 2. Multi-region Normalized Cross Correlation (Upper eyes/brows & Mid nose/cheeks)
    const size = feat1.size;
    const totalPixels = size * size;

    // Upper region (forehead, brows, eyes - top 35%)
    const upperEnd = Math.floor(totalPixels * 0.35);
    let dotUpper = 0, sumSq1Upper = 0, sumSq2Upper = 0;
    for (let i = 0; i < upperEnd; i++) {
      dotUpper += feat1.normGray[i] * feat2.normGray[i];
      sumSq1Upper += feat1.normGray[i] * feat1.normGray[i];
      sumSq2Upper += feat2.normGray[i] * feat2.normGray[i];
    }
    const nccUpper = Math.max(0, dotUpper / (Math.sqrt(sumSq1Upper * sumSq2Upper) || 1));

    // Mid region (eyes to nose - 35% to 70%)
    const midEnd = Math.floor(totalPixels * 0.70);
    let dotMid = 0, sumSq1Mid = 0, sumSq2Mid = 0;
    for (let i = upperEnd; i < midEnd; i++) {
      dotMid += feat1.normGray[i] * feat2.normGray[i];
      sumSq1Mid += feat1.normGray[i] * feat1.normGray[i];
      sumSq2Mid += feat2.normGray[i] * feat2.normGray[i];
    }
    const nccMid = Math.max(0, dotMid / (Math.sqrt(sumSq1Mid * sumSq2Mid) || 1));

    // Full face normalized cross correlation
    let dotAll = 0, sumSq1 = 0, sumSq2 = 0;
    for (let i = 0; i < totalPixels; i++) {
      dotAll += feat1.normGray[i] * feat2.normGray[i];
      sumSq1 += feat1.normGray[i] * feat1.normGray[i];
      sumSq2 += feat2.normGray[i] * feat2.normGray[i];
    }
    const nccOverall = Math.max(0, dotAll / (Math.sqrt(sumSq1 * sumSq2) || 1));

    // 3. Combined Biometric Score: 40% Gradient structure, 30% Key facial regions, 30% Overall intensity
    const combinedScore = (0.40 * hogSim) + (0.30 * ((nccUpper + nccMid) / 2)) + (0.30 * nccOverall);

    // Strict criteria: overall >= threshold AND regional alignment >= 0.50
    const verified = combinedScore >= threshold && nccUpper >= 0.50 && nccMid >= 0.45;
    const matchPercentage = Math.round(Math.min(99.4, Math.max(10, (combinedScore / 0.88) * 100)) * 10) / 10;

    return {
      verified,
      score: Math.round(combinedScore * 1000) / 1000,
      matchPercentage: verified ? Math.max(85.0, matchPercentage) : Math.min(68.5, matchPercentage),
      hogSim: Math.round(hogSim * 1000) / 1000,
      nccUpper: Math.round(nccUpper * 1000) / 1000,
      nccMid: Math.round(nccMid * 1000) / 1000
    };
  } catch (err) {
    console.error('Biometric analysis error:', err);
    return {
      verified: false,
      score: 0,
      matchPercentage: 0,
      error: err.message
    };
  }
}
