export default function StepText({ eyebrow, headline, body, children }) {
  return (
    <div className="step-card">
      {eyebrow && <div className="step-card__eyebrow">{eyebrow}</div>}
      {headline && <h3 className="step-card__headline">{headline}</h3>}
      {body && <p className="step-card__body">{body}</p>}
      {children}
    </div>
  );
}
