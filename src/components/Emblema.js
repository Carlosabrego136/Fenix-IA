export default function Emblema({ tam = 64 }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/logo-256.png"
      width={tam}
      height={tam}
      alt=""
      aria-hidden="true"
      style={{ borderRadius: '22%', display: 'block', flex: 'none', boxShadow: '0 2px 10px rgba(11,79,179,.28)' }}
    />
  );
}
