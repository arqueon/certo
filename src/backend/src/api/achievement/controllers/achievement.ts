/**
 * achievement controller
 */

import { factories } from '@strapi/strapi'
import { achievementsCreatedTotal } from '../../../monitoring/metrics'

interface Achievement {
  id: any
  name: string
  description: string
  credentials?: any[]
  image?: any
  creator?: any
  tags?: any
}

/**
 * Strapi 5's content-API relation validator (throw-restricted-relations,
 * @strapi/utils) rejects ANY relation key (e.g. "creator") sent in a
 * create/update body for a request authenticated via the users-permissions
 * JWT strategy - it needs ctx.state.auth.strategy.verify, which that
 * strategy never populates (auth queda como {} para peticiones JWT de
 * content-API, confirmado empiricamente contra Strapi 5.15). No es un bug
 * nuestro: afecta a cualquier relacion manyToOne/oneToOne enviada asi,
 * pase lo que pase con los permisos del rol. Se evita quitando la relacion
 * del payload antes de super.create()/super.update() y aplicandola despues
 * con una llamada interna al document service, que no pasa por ese
 * validador (mismo patron ya usado en clr.ts/credential.ts de este fork).
 */
function extraerCreator(data: Record<string, any>): number | string | undefined {
  const { creator } = data
  delete data.creator
  if (creator === undefined || creator === null) return undefined
  if (typeof creator === 'object' && 'connect' in creator) {
    const conectados = creator.connect
    return Array.isArray(conectados) ? (conectados[0]?.id ?? conectados[0]) : undefined
  }
  if (typeof creator === 'object' && 'set' in creator) {
    return Array.isArray(creator.set) ? creator.set[0] : creator.set
  }
  return creator
}

async function aplicarCreator(strapi: any, documentId: string, creatorId: number | string | undefined) {
  if (creatorId === undefined) return
  await strapi.documents('api::achievement.achievement').update({
    documentId,
    data: { creator: creatorId },
  })
}

export default factories.createCoreController('api::achievement.achievement', ({ strapi }) => ({
  // Custom controller method to handle creation with empty tags
  async create(ctx) {
    try {
      // Get the data from the request body
      const { data } = ctx.request.body;
      
      // Handle empty tags
      if (data.tags === '' || data.tags === undefined || data.tags === null) {
        data.tags = [];
      }

      const creatorId = extraerCreator(data)

      // Use the core controller's create which enforces Strapi RBAC
      const response = await super.create(ctx);
      const entity = response.data ?? response;

      await aplicarCreator(strapi, entity.documentId, creatorId)
      if (creatorId !== undefined) {
        entity.creator = creatorId
      }

      const auditLog = strapi.service('api::audit-log-entry.audit-log')
      await auditLog.record({
        action: 'achievement.create',
        entityType: 'achievement',
        entityId: entity.id,
        actorId: ctx.state.user?.id,
        metadata: { name: entity.name },
      })
      achievementsCreatedTotal.inc()

      await strapi.service('api::webhook-subscription.dispatch').dispatch('achievement.created', {
        achievementId: entity.id,
        name: entity.name,
        actorId: ctx.state.user?.id,
      })

      // Return the created entity
      return response;
    } catch (error) {
      console.error('Error creating achievement:', error);
      return ctx.badRequest('Failed to create achievement', { error: error.message });
    }
  },
  
  // Custom method to find achievement with credentials
  async findWithCredentials(ctx) {
    try {
      const { id } = ctx.params
      
      const achievement = await strapi.entityService.findOne('api::achievement.achievement', id, {
        status: 'published',
        populate: ['credentials', 'credentials.recipient', 'image', 'creator']
      }) as Achievement
      
      if (!achievement) {
        return ctx.notFound('Achievement not found')
      }
      
      return { data: achievement }
    } catch (err) {
      ctx.badRequest('Error fetching achievement', { error: err })
    }
  },
  
  // Custom method to find achievements by creator id
  async findByCreator(ctx) {
    try {
      const { creatorId } = ctx.params
      if (!creatorId) {
        return ctx.badRequest('Missing creatorId parameter')
      }
      const achievements = await strapi.entityService.findMany('api::achievement.achievement', {
        status: 'published',
        filters: { creator: { id: creatorId } },
        populate: '*',
      })
      return { data: achievements }
    } catch (err) {
      ctx.badRequest('Error fetching achievements by creator', { error: err })
    }
  }
}))
