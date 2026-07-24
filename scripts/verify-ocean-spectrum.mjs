import assert from "node:assert/strict";
import { createTessendorfOceanSpectrum } from "../dist-test/ocean-spectrum.js";

const first = createTessendorfOceanSpectrum(32, 8);
const second = createTessendorfOceanSpectrum(32, 8);
try {
  const a = first.texture.image.data;
  const b = second.texture.image.data;
  assert.equal(first.frames, 8);
  assert.equal(first.resolution, 32);
  assert.equal(a.length, 32 * 32 * 8 * 4);
  assert.deepEqual(a, b, "the seeded ocean spectrum must be deterministic");
  const ranges = Array.from({ length: 4 }, (_, channel) => {
    let minimum = 255, maximum = 0;
    for (let index = channel; index < a.length; index += 4) {
      minimum = Math.min(minimum, a[index]);
      maximum = Math.max(maximum, a[index]);
    }
    return { minimum, maximum };
  });
  assert(ranges[0].maximum - ranges[0].minimum > 80, "X displacement has no useful range");
  assert(ranges[1].maximum - ranges[1].minimum > 80, "Z displacement has no useful range");
  assert(ranges[2].maximum - ranges[2].minimum > 80, "height has no useful range");
  assert(ranges[3].maximum > 4, "Jacobian foam channel is empty");
  console.log(JSON.stringify({ frames: first.frames, resolution: first.resolution, ranges }, null, 2));
} finally {
  first.texture.dispose();
  second.texture.dispose();
}
