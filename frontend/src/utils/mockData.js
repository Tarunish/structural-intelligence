export function getMockData() {
  return {
    parsed: {
      fallback_used: true,
      summary: { total_walls: 9, load_bearing: 6, partition: 3, total_rooms: 6, total_openings: 4 },
      walls: [
        { start: [0.0, 0.0], end: [1.0, 0.0], classification: 'LOAD_BEARING', span_m: 9.0 },
        { start: [1.0, 0.0], end: [1.0, 1.0], classification: 'LOAD_BEARING', span_m: 9.0 },
        { start: [1.0, 1.0], end: [0.0, 1.0], classification: 'LOAD_BEARING', span_m: 9.0 },
        { start: [0.0, 1.0], end: [0.0, 0.0], classification: 'LOAD_BEARING', span_m: 9.0 },
        { start: [0.5, 0.0], end: [0.5, 0.6], classification: 'LOAD_BEARING', span_m: 5.4 },
        { start: [0.0, 0.5], end: [0.5, 0.5], classification: 'LOAD_BEARING', span_m: 4.5 },
        { start: [0.5, 0.5], end: [1.0, 0.5], classification: 'LOAD_BEARING', span_m: 4.5 },
        { start: [0.25, 0.5], end: [0.25, 1.0], classification: 'PARTITION', span_m: 4.5 },
        { start: [0.75, 0.5], end: [0.75, 1.0], classification: 'PARTITION', span_m: 4.5 },
      ],
      rooms: [
        { id: 'r0', label: 'GREAT_ROOM', centroid_normalized: [0.25, 0.25] },
        { id: 'r1', label: 'KITCHEN', centroid_normalized: [0.75, 0.25] },
        { id: 'r2', label: 'BEDROOM_1', centroid_normalized: [0.12, 0.75] },
        { id: 'r3', label: 'BEDROOM_2', centroid_normalized: [0.37, 0.75] },
        { id: 'r4', label: 'BEDROOM_3', centroid_normalized: [0.62, 0.75] },
        { id: 'r5', label: 'BEDROOM_4', centroid_normalized: [0.87, 0.75] },
      ],
      openings: []
    },
    materials: {
      estimated_total_cost_inr: 285400,
      cost_breakdown: {
        load_bearing: 154100,
        partition: 42000,
        slab: 89300
      },
      recommendations: [
        {
          element_type: 'LOAD_BEARING', span_m: 9.0,
          structural_concerns: [
            '⚠️ Long unsupported span of 9.0m detected - steel frame or RCC required',
            '⚠️ Wind load shear risk on South-East face',
            '⚠️ Foundation requires isolated footing due to high point load',
            '⚠️ Settlement risk detected if soil bearing capacity < 150 kN/m²'
          ],
          top_materials: [
            { tradeoff_score: 0.88, material: { name: 'RCC Frame', description: 'Reinforced concrete - highest structural capacity, ideal for slabs and columns', cost_score: 3, strength_score: 4, durability_score: 4, cost_per_sqm: 1200 } },
            { tradeoff_score: 0.72, material: { name: 'Red Brick', description: 'Traditional fired clay brick - reliable load-bearing, widely available', cost_score: 2, strength_score: 3, durability_score: 2, cost_per_sqm: 650 } },
          ]
        },
        {
          element_type: 'PARTITION', span_m: 4.5,
          structural_concerns: [
            '⚠️ Minor deflection expected on non-load bearing 4.5m span',
            '⚠️ Ensure expansion joints are present every 3m'
          ],
          top_materials: [
            { tradeoff_score: 0.82, material: { name: 'AAC Blocks', description: 'Autoclaved Aerated Concrete - lightweight, good insulation, easy to cut', cost_score: 1, strength_score: 2, durability_score: 3, cost_per_sqm: 450 } },
            { tradeoff_score: 0.74, material: { name: 'Fly Ash Brick', description: 'Eco-friendly industrial byproduct brick - good compressive strength, sustainable', cost_score: 1, strength_score: 2, durability_score: 3, cost_per_sqm: 420 } },
          ]
        },
        {
          element_type: 'SLAB', span_m: 4.0,
          structural_concerns: [],
          top_materials: [
            { tradeoff_score: 0.91, material: { name: 'Concrete Slab (RCC)', description: 'Best-in-class for floor slabs - very high flexural strength, 50+ year durability', cost_score: 3, strength_score: 4, durability_score: 4, cost_per_sqm: 1200 } },
            { tradeoff_score: 0.65, material: { name: 'Hollow Core Plank', description: 'Precast prestressed concrete elements allowing rapid construction', cost_score: 4, strength_score: 4, durability_score: 3, cost_per_sqm: 1500 } }
          ]
        }
      ],
      explanation: `### STRUCTURAL MATERIAL ANALYSIS
**Plan B (4 Bedrooms / 3 Bathrooms)**

#### 🏗️ Overall Strategy
This multi-room layout features a **central structural spine** dividing the Great Room and Kitchen zone from the four-bedroom wing. The strategy strongly prioritizes **RCC** for all load-bearing elements due to the **9m external spans** exceeding safe masonry thresholds.

#### 🧱 Load-Bearing Walls (6 detected)
**RCC (Reinforced Concrete)** scores **88%** on the tradeoff model for load-bearing walls at a 9m span. The outer boundary walls carry the full dead + live load of the structure.
* At this span length, traditional masonry (**Red Brick**, score 72%) is structurally insufficient without additional columns.
* RCC's strength score of **4/4** is non-negotiable here.

#### ⬛ Partition Walls (3 detected)
**AAC Blocks** score **82%** for internal partition walls. Since these walls carry strictly zero structural load, cost-efficiency is heavily weighted at 60%.
* AAC's low cost score (1/3) and solid durability (3/3) make it the optimal choice.
* **Fly Ash Brick** is a great sustainable alternative at 74%.

#### 🔲 Floor Slab
**RCC Slab** scores **91%**, the highest in the database. A **4m typical room span** is well within RCC's capabilities utilizing a standard single-mat reinforcement layout.`
    }
  };
}
