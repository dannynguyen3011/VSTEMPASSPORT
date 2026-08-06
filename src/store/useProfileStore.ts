'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Activity, TargetMajor, UserProfile } from '@/types'
import { buildInitialUserData, USER_SWITCH_OPTIONS, type UserSwitchOption } from '@/shared/demoUsers'

const initial = buildInitialUserData()
const DEFAULT_USER_ID = 'user-new'

interface ProfileStore {
  currentUserId: string
  userOptions: UserSwitchOption[]
  profilesById: Record<string, UserProfile>
  activitiesByUserId: Record<string, Activity[]>
  profile: UserProfile
  activities: Activity[]
  /** Called after login — loads real DB data into the store */
  setAuthenticatedUser: (profile: UserProfile, activities: Activity[]) => void
  setCurrentUser: (userId: string) => void
  createUser: (payload: {
    display_name: string
    grade: 10 | 11 | 12
    school_name: string
    province: string
    target_major: TargetMajor
  }) => void
  updateProfile: (data: Partial<UserProfile>) => void
  addActivity: (
    activity: Omit<
      Activity,
      'activity_id' | 'user_id' | 'created_at' | 'tech_tags' | 'base_score' | 'trust_verified_by' | 'artifact_url'
    >
  ) => void
  /** Add an activity that already has a server-generated ID (returned from POST /api/activities) */
  addServerActivity: (activity: Activity) => void
  removeActivity: (id: string) => void
  updateSlotOrder: (id: string, slot: number | null) => void
}

function snapshotFor(
  userId: string,
  profiles: Record<string, UserProfile>,
  activities: Record<string, Activity[]>
): { profile: UserProfile; activities: Activity[] } {
  const profile = profiles[userId]
  const list = activities[userId] ?? []
  if (!profile) {
    const fallback = profiles[DEFAULT_USER_ID]
    return { profile: fallback, activities: activities[DEFAULT_USER_ID] ?? [] }
  }
  return { profile, activities: list }
}

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      currentUserId: DEFAULT_USER_ID,
      userOptions: USER_SWITCH_OPTIONS,
      profilesById: initial.profilesById,
      activitiesByUserId: initial.activitiesByUserId,
      ...snapshotFor(DEFAULT_USER_ID, initial.profilesById, initial.activitiesByUserId),

      setAuthenticatedUser: (userProfile, userActivities) =>
        set((state) => ({
          currentUserId: userProfile.user_id,
          profilesById: { ...state.profilesById, [userProfile.user_id]: userProfile },
          activitiesByUserId: { ...state.activitiesByUserId, [userProfile.user_id]: userActivities },
          profile: userProfile,
          activities: userActivities,
        })),

      setCurrentUser: (userId) =>
        set((state) => {
          if (!state.profilesById[userId]) return state
          const { profile, activities } = snapshotFor(userId, state.profilesById, state.activitiesByUserId)
          return {
            currentUserId: userId,
            profile,
            activities,
          }
        }),

      createUser: (payload) =>
        set((state) => {
          const baseSlug = slugifyName(payload.display_name) || 'user'
          const userId = `user-${baseSlug}-${Date.now().toString().slice(-6)}`
          const nextProfile: UserProfile = {
            user_id: userId,
            display_name: payload.display_name,
            grade: payload.grade,
            school_name: payload.school_name,
            province: payload.province,
            gpa: null,
            sat_score: null,
            ielts_score: null,
            target_major: payload.target_major,
            target_schools: ['vinuni', 'hust', 'usth', 'vju', 'fulbright', 'swinburne'],
          }
          const nextOption: UserSwitchOption = {
            user_id: userId,
            label: payload.display_name,
            description: `${payload.school_name} · Lớp ${payload.grade}`,
          }

          return {
            currentUserId: userId,
            userOptions: [...state.userOptions, nextOption],
            profilesById: { ...state.profilesById, [userId]: nextProfile },
            activitiesByUserId: { ...state.activitiesByUserId, [userId]: [] },
            profile: nextProfile,
            activities: [],
          }
        }),

      updateProfile: (data) =>
        set((state) => {
          const id = state.currentUserId
          const nextProfile = { ...state.profilesById[id], ...data } as UserProfile
          const profilesById = { ...state.profilesById, [id]: nextProfile }
          return {
            profilesById,
            profile: nextProfile,
          }
        }),

      addActivity: (activityData) =>
        set((state) => {
          const id = state.currentUserId
          const userActivities = state.activitiesByUserId[id] ?? []
          const bumped = userActivities.map((activity) =>
            activity.slot_order !== null && activity.slot_order === activityData.slot_order
              ? { ...activity, slot_order: null }
              : activity
          )
          const newActivity: Activity = {
            ...activityData,
            activity_id: `activity-${id}-${Date.now()}`,
            user_id: id,
            tech_tags: [],
            base_score: 3,
            trust_verified_by: null,
            artifact_url: null,
            created_at: new Date().toISOString(),
          }
          const nextList = [...bumped, newActivity]
          const activitiesByUserId = { ...state.activitiesByUserId, [id]: nextList }
          return {
            activitiesByUserId,
            activities: nextList,
          }
        }),

      addServerActivity: (activity) =>
        set((state) => {
          const id = state.currentUserId
          const userActivities = state.activitiesByUserId[id] ?? []
          // Bump any existing activity that's in the same slot (server-side already
          // enforces uniqueness but mirror it locally so UI is consistent)
          const bumped = userActivities.map((a) =>
            a.slot_order !== null && a.slot_order === activity.slot_order
              ? { ...a, slot_order: null }
              : a
          )
          const nextList = [...bumped, activity]
          return {
            activitiesByUserId: { ...state.activitiesByUserId, [id]: nextList },
            activities: nextList,
          }
        }),

      removeActivity: (activityId) =>
        set((state) => {
          const id = state.currentUserId
          const userActivities = state.activitiesByUserId[id] ?? []
          const nextList = userActivities.filter((a) => a.activity_id !== activityId)
          const activitiesByUserId = { ...state.activitiesByUserId, [id]: nextList }
          return {
            activitiesByUserId,
            activities: nextList,
          }
        }),

      updateSlotOrder: (activityId, slot) =>
        set((state) => {
          const id = state.currentUserId
          const userActivities = state.activitiesByUserId[id] ?? []
          const nextList = userActivities.map((a) =>
            a.activity_id === activityId ? { ...a, slot_order: slot } : a
          )
          const activitiesByUserId = { ...state.activitiesByUserId, [id]: nextList }
          return {
            activitiesByUserId,
            activities: nextList,
          }
        }),
    }),
    {
      name: 'gsc-profile-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        userOptions: state.userOptions,
        profilesById: state.profilesById,
        activitiesByUserId: state.activitiesByUserId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const { profile, activities } = snapshotFor(
          state.currentUserId,
          state.profilesById,
          state.activitiesByUserId
        )
        state.profile = profile
        state.activities = activities
      },
    }
  )
)
