import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
const faqs = [
  [
    "What can I build with BuildX?",
    "Start with a web app idea: a team workspace, a dashboard, a marketplace, or a booking tool. BuildX helps you develop its architecture and scaffold the code you can review and refine.",
  ],
  [
    "Is the workspace on this page interactive?",
    "The guided demo simulates a BuildX generation. You can pause, replay, and inspect its stages and example outputs. Open Studio to describe your own project and use the working editor.",
  ],
  [
    "Can I take the code with me?",
    "You can download your project as a ZIP or export it to a connected GitHub account. Review the generated code and configure the services it needs before running it in your own environment.",
  ],
  [
    "How does the AI workflow work?",
    "BuildX coordinates planning, code generation, and refinement stages with configured AI models. The application shows progress and reports errors so you can review the result and decide what to change.",
  ],
];
export function FAQSection() {
  const [open, setOpen] = useState<number[]>([]);
  const reduced = useReducedMotion();
  return (
    <section className="landing-section faq-section" id="faq">
      <div className="landing-container faq-layout">
        <div className="section-intro">
          <p className="eyebrow">04 / A FEW GOOD QUESTIONS</p>
          <h2>
            Before you
            <br />
            start building.
          </h2>
        </div>
        <div>
          {faqs.map(([question, answer], index) => (
            <div className="faq-item" key={question}>
              <h3>
                <button
                  type="button"
                  className="faq-question"
                  id={`faq-question-${index}`}
                  aria-expanded={open.includes(index)}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() =>
                    setOpen((current) =>
                      current.includes(index)
                        ? current.filter((item) => item !== index)
                        : [...current, index],
                    )
                  }
                >
                  {question}
                  <span aria-hidden="true">+</span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open.includes(index) && (
                  <motion.div
                    id={`faq-answer-${index}`}
                    className="faq-answer"
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.22 }}
                  >
                    <p>{answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
