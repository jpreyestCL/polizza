/**
 * Cálculo de prima bruta. Módulo puro (sin `server-only`) para poder
 * ejercitarlo desde los tests.
 */

/** IVA chileno. Solo grava la porción afecta de la prima. */
export const IVA_RATE = 0.19;

type CoverageSplit = { premiumAffect: unknown; premiumExempt: unknown };

/**
 * Prima bruta = prima afecta × 1.19 + prima exenta.
 *
 * El IVA se calcula SOBRE LA PRIMA AFECTA, nunca sobre la neta total: una
 * póliza con prima neta 53,24 (9,12 afecta + 44,12 exenta) tiene prima bruta
 * 54,97, no 63,36.
 *
 * El desglose se busca en dos lugares, en este orden:
 *  1. Las coberturas de la propuesta de origen (pólizas emitidas en Polizza).
 *  2. Los campos `premiumAffect` / `premiumExempt` de la propia póliza, que es
 *     donde vive el desglose de las pólizas importadas del legacy.
 *
 * Solo si no hay desglose por ninguna vía se asume que todo es afecto.
 */
export function computeGross(
  net: number | null,
  proposal: { items: { coverages: CoverageSplit[] }[] } | null,
  policy?: CoverageSplit | null,
): number | null {
  if (proposal) {
    let affect = 0;
    let exempt = 0;
    let hasSplit = false;
    for (const it of proposal.items) {
      for (const c of it.coverages) {
        if (c.premiumAffect != null) {
          affect += Number(c.premiumAffect);
          hasSplit = true;
        }
        if (c.premiumExempt != null) {
          exempt += Number(c.premiumExempt);
          hasSplit = true;
        }
      }
    }
    if (hasSplit && affect + exempt > 0) return affect * (1 + IVA_RATE) + exempt;
  }

  if (policy && (policy.premiumAffect != null || policy.premiumExempt != null)) {
    const affect =
      policy.premiumAffect != null ? Number(policy.premiumAffect) : 0;
    const exempt =
      policy.premiumExempt != null ? Number(policy.premiumExempt) : 0;
    if (affect + exempt > 0) return affect * (1 + IVA_RATE) + exempt;
  }

  return net != null ? net * (1 + IVA_RATE) : null;
}
