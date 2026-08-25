import type { TourId } from '../stores/TourStore'
import { firstRunTour } from './steps/firstRunTour'
import { workflowTour } from './steps/workflowTour'
import type { TourDefinition } from './tourTypes'

export const TOURS: Record<TourId, TourDefinition> = {
    'first-run': firstRunTour,
    workflows: workflowTour,
}

export const TOUR_LABELS: Record<TourId, string> = {
    'first-run': 'Getting started',
    workflows: 'Workflows & Designer',
}
