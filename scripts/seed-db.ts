/**
 * Database seed script — populates Big 6 school personas and demo opportunities
 * Run: npx tsx scripts/seed-db.ts
 *
 * Requires MONGODB_URI in .env.local
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import mongoose from 'mongoose'
import { SchoolPersona, Opportunity, Mentor } from '../src/backend/db/models'
import { BIG6_SCHOOLS, DEMO_OPPORTUNITIES, DEMO_MENTORS } from '../src/shared/constants'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set')

  await mongoose.connect(uri)
  console.log('🌱 Seeding database...')

  // ── School Personas ────────────────────────────────────────────────────────
  console.log('  → Inserting Big 6 school personas...')
  for (const school of BIG6_SCHOOLS) {
    await SchoolPersona.updateOne(
      { _id: school.school_id },
      {
        $setOnInsert: {
          school_name: school.school_name,
          short_name: school.short_name,
          min_sat: school.min_sat,
          min_gpa: school.min_gpa,
          min_ielts: school.min_ielts,
          has_interview: school.has_interview,
          min_portfolio_activities: school.min_portfolio_activities,
          preferred_categories: school.preferred_categories,
          persona_description: school.persona_description,
          source_doc: 'Đề án tuyển sinh 2026',
          source_page: '—',
          effective_year: 2026,
        },
      },
      { upsert: true }
    )
  }
  console.log(`  ✓ ${BIG6_SCHOOLS.length} schools seeded`)

  // ── Demo Opportunities ─────────────────────────────────────────────────────
  console.log('  → Inserting demo STEM opportunities...')
  for (const opp of DEMO_OPPORTUNITIES) {
    await Opportunity.updateOne(
      { source_url: opp.source_url },
      {
        $setOnInsert: {
          name: opp.name,
          type: opp.type,
          field_tags: opp.field_tags,
          scope: opp.scope,
          is_online: opp.is_online,
          is_free: opp.is_free,
          deadline: new Date(opp.deadline),
          source_url: opp.source_url,
          description: opp.description,
          admin_verified: opp.admin_verified,
        },
      },
      { upsert: true }
    )
  }
  console.log(`  ✓ ${DEMO_OPPORTUNITIES.length} opportunities seeded`)

  // ── Demo Mentors ───────────────────────────────────────────────────────────
  console.log('  → Inserting demo mentors...')
  for (const mentor of DEMO_MENTORS) {
    await Mentor.updateOne(
      { display_name: mentor.display_name, school: mentor.school },
      {
        $setOnInsert: {
          display_name: mentor.display_name,
          school: mentor.school,
          major: mentor.major,
          expertise_tags: mentor.expertise_tags,
          bio: mentor.bio,
          is_active: mentor.is_active,
          verified: mentor.verified,
          rating: mentor.rating,
        },
      },
      { upsert: true }
    )
  }
  console.log(`  ✓ ${DEMO_MENTORS.length} mentors seeded`)

  console.log('✅ Database seeded successfully!')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
