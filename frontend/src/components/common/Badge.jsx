export default function Badge({ ok }) {
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-fail"}`}>
      {ok ? "PASS" : "FAIL"}
    </span>
  );
}


