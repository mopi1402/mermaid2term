// TRANSCRIBED from the East Asian Width data of Unicode 14.0.0. Nothing here is this package's to decide: do not
// edit by hand, rerun `pnpm eastasianwidth`.

const PACKED =
  "3cw.2n,3i3.1,e.1,5b.3,4.0,3.0,ei.1,m.1,1f.b,18.0,k.0,e.0,9.1,i.1,6.1,9.0,6.0,m.0,8.1,2.0,5.0,3.0,8.0,5.1,t.0,10.0,2.0," +
  "5.2,2.0,1q.2,p.0,f.0,nw.1,1g.0,5.0,mj.p,2.2g,d.5x,r.b,5.1q,3.2d,3.2u,6.16,2.2l,2.2b,d.1a,2.13,9.5f3,1t.h3g,4.1i,wq.s,h" +
  "w.8mb,6l9.e7,lt.9,n.y,2.i,2.3,46.2n,3k.6,m4a.4,c.1,f.4qf,9.yd,17.8,6w8.3,2.6,2.1,2.82,1a.2,i.3,9.az,c21.0,5n.0,5b.0,3." +
  "9,2u.2,e.17,5.8,8.1,f.5,4b.w,d.8,2.1x,2.l,d.16,5.4,d.g,4.0,4.1y,2.0,2.56,3.1q,e.3,2.n,j.0,r.1,e.0,2f.2c,1d.1x,7.0,4.2," +
  "3.2,6.2,c.1,8.8,6c.b,5.0,7w.1a,2.9,2.54,35.4,4.4,4.6,a.s,4.a,6.5,b.9,7.7,9.6,zu.1ekd,3.1ekd";

const RADIX = 36;
const PAIR = ".";
const NEXT = ",";

const STARTS: number[] = [];
const ENDS: number[] = [];
{
  let at = 0;
  for (const pair of PACKED.split(NEXT)) {
    const [gap, length] = pair.split(PAIR);
    const start = at + Number.parseInt(gap, RADIX);
    const end = start + Number.parseInt(length, RADIX);
    STARTS.push(start);
    ENDS.push(end);
    at = end;
  }
}

// Read off the table rather than written out again, which would drift the next time the table is regenerated.
export const FIRST_WIDE = STARTS[0];

export function isFullwidthOrWide(cp: number): boolean {
  let low = 0;
  let high = STARTS.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cp < STARTS[mid]) high = mid - 1;
    else if (cp > ENDS[mid]) low = mid + 1;
    else return true;
  }
  return false;
}
