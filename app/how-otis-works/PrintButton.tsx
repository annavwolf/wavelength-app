"use client";

import styles from "./journey.module.css";

export default function PrintButton() {
  return (
    <button
      type="button"
      className={styles.printButton}
      onClick={() => window.print()}
    >
      Print / save as PDF
    </button>
  );
}
