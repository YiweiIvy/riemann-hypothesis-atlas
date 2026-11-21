# Share Riemann Hypothesis Atlas

[Open the atlas](https://yiweiivy.github.io/riemann-hypothesis-atlas/) · [Watch the walkthrough](https://yiweiivy.github.io/riemann-hypothesis-atlas/tour/) · [Browse the code](https://github.com/YiweiIvy/riemann-hypothesis-atlas)

## Short post

Levent Alpöge proposed a proof of the Riemann hypothesis, developed with Claude. I used James Shore’s data to build an atlas of its Lean code. Click any of 804,912 declarations to read its source.

Announcement → https://alpo.ge/remark.pdf
Atlas → https://yiweiivy.github.io/riemann-hypothesis-atlas/

[Attach the short video](https://yiweiivy.github.io/riemann-hypothesis-atlas/share/galaxy-teaser.mp4) · [Download the share card](https://yiweiivy.github.io/riemann-hypothesis-atlas/share/riemann-hypothesis-atlas.png)

**Image description**

A star map of Lean declarations in Levent Alpöge’s proposed proof, developed with Claude. The card credits YiweiIvy for the atlas and James Shore for the data. The RH declaration sits between clusters for theta lifts, prime estimates and abelian varieties.

## For a Lean or math community

**Title**

An atlas of the Lean dependencies in Levent Alpöge’s proposed proof of the Riemann hypothesis

**Post**

Levent Alpöge published a proposed proof of the Riemann hypothesis and credits Claude with helping develop the argument and formalize it in Lean. His four-page announcement links the original fourteen-part source archive. [Original announcement](https://alpo.ge/remark.pdf#page=1)

I built the interactive atlas using James Shore’s v0.2 dependency data. It links 804,912 Lean declarations to the corresponding source lines in CocoSgt’s mirror. A good place to start is “Trace a proof path” on the RH statement. The 13 stops take you from the statement to a prime-sum error bound. Select any stop and you can read the Lean lines or branch into its other dependencies.

I’d especially like help checking the passage from pointwise estimates to windows. Pick a star and choose **Contribute verification** to share the source lines or run log and what you found. Once a maintainer accepts your check, the star’s evidence timeline links back to your issue. [Try a worked example](https://github.com/YiweiIvy/riemann-hypothesis-atlas/blob/main/docs/verification.md)

[Open the 13-node path](https://yiweiivy.github.io/riemann-hypothesis-atlas/#map/trail/1/riemannHypothesis) · [Open an issue or star the repository](https://github.com/YiweiIvy/riemann-hypothesis-atlas) · [Dependency data](https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2)
