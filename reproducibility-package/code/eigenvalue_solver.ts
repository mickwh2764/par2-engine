export interface ComplexNumber {
  real: number;
  imag: number;
}

export interface EigenvalueResult {
  lambda1: ComplexNumber;
  lambda2: ComplexNumber;
  isComplex: boolean;
  modulus1: number;
  modulus2: number;
  argument1: number | null;
  argument2: number | null;
}

export interface EigenperiodResult {
  eigenperiodHours: number | null;
  dampingRate: number | null;
  halfLifeTimesteps: number | null;
  isOscillatory: boolean;
}

export function solveAR2Eigenvalues(beta1: number, beta2: number): EigenvalueResult {
  const discriminant = beta1 * beta1 + 4 * beta2;

  if (discriminant >= 0) {
    const sqrtD = Math.sqrt(discriminant);
    const lambda1: ComplexNumber = { real: (beta1 + sqrtD) / 2, imag: 0 };
    const lambda2: ComplexNumber = { real: (beta1 - sqrtD) / 2, imag: 0 };
    return {
      lambda1,
      lambda2,
      isComplex: false,
      modulus1: Math.abs(lambda1.real),
      modulus2: Math.abs(lambda2.real),
      argument1: null,
      argument2: null,
    };
  }

  const realPart = beta1 / 2;
  const imagPart = Math.sqrt(-discriminant) / 2;
  const lambda1: ComplexNumber = { real: realPart, imag: imagPart };
  const lambda2: ComplexNumber = { real: realPart, imag: -imagPart };
  const modulus = Math.sqrt(realPart * realPart + imagPart * imagPart);
  const arg1 = Math.atan2(imagPart, realPart);
  const arg2 = Math.atan2(-imagPart, realPart);

  return {
    lambda1,
    lambda2,
    isComplex: true,
    modulus1: modulus,
    modulus2: modulus,
    argument1: arg1,
    argument2: arg2,
  };
}

export function computeEigenperiod(result: EigenvalueResult, samplingIntervalHours: number = 2): EigenperiodResult {
  if (!result.isComplex || result.argument1 === null) {
    const maxMod = Math.max(result.modulus1, result.modulus2);
    return {
      eigenperiodHours: null,
      dampingRate: maxMod > 0 && maxMod < 1 ? -Math.log(maxMod) : null,
      halfLifeTimesteps: maxMod > 0 && maxMod < 1 ? Math.log(0.5) / Math.log(maxMod) : null,
      isOscillatory: false,
    };
  }

  const arg = Math.abs(result.argument1);
  const periodSamples = arg > 1e-10 ? (2 * Math.PI) / arg : null;
  const eigenperiodHours = periodSamples ? periodSamples * samplingIntervalHours : null;
  const maxMod = result.modulus1;

  return {
    eigenperiodHours,
    dampingRate: maxMod > 0 && maxMod < 1 ? -Math.log(maxMod) : null,
    halfLifeTimesteps: maxMod > 0 && maxMod < 1 ? Math.log(0.5) / Math.log(maxMod) : null,
    isOscillatory: true,
  };
}

export function classifyDynamics(eigenvalue: number, isComplex: boolean): string {
  if (eigenvalue >= 1.05) return "Unstable";
  if (eigenvalue >= 0.95) return "Near-Critical";
  if (eigenvalue >= 0.7) return "Persistent";
  if (eigenvalue >= 0.5) return "Moderate";
  if (eigenvalue >= 0.3) return "Weak";
  return "Rapidly Decaying";
}
