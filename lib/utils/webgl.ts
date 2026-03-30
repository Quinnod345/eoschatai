export function canCreateWebGLContext(preferWebGL2 = false): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const canvas = document.createElement('canvas');

  try {
    if (preferWebGL2) {
      const webgl2 = canvas.getContext('webgl2');
      if (webgl2) return true;
    }

    const webgl = canvas.getContext('webgl');
    if (webgl) return true;

    const experimentalWebgl = canvas.getContext('experimental-webgl');
    return !!experimentalWebgl;
  } catch {
    return false;
  }
}
