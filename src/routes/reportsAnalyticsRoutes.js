// routes/reportsAnalytics.routes.js
import {
    getOverview,
    getHoursByProject,
    getHoursWeekly,
    getTopStudents,
    getHoursByStatus,
    getInstitutionsSummary,
    getStudentDetail,
    getProjectDetail,
    getInactiveStudents,
    getCompletionRate,
    getGroupSummary,        // ← NUEVO
    getCareerReport,
    exportDashboardPDF,
    exportStudentPDF,
    exportGroupPDF,
    exportCareerPDF,
    exportGeneralReportPDF,
    exportIndividualReportPDF,         // ← NUEVO
    exportAdvancedStatsPDF,
} from '../controllers/reportsAnalytics.controller.js';

async function reportsAnalyticsRoutes(fastify) {

    // ── Resúmenes generales ────────────────────────────────────────────────────

    fastify.get('/reports/overview', {
        schema: {
            description: 'Resumen general: total de horas aprobadas, proyectos activos, estudiantes registrados y promedio de horas por estudiante.',
            tags: ['Reportes'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        totalHoras: { type: 'number' },
                        totalProyectos: { type: 'number' },
                        totalEstudiantes: { type: 'number' },
                        promedioHorasPorEstudiante: { type: 'number' },
                    },
                },
            },
        },
    }, getOverview);

    fastify.get('/reports/hours-by-project', {
        schema: {
            description: 'Horas aprobadas agrupadas por proyecto, ordenadas de mayor a menor.',
            tags: ['Reportes'],
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            proyecto_id: { type: 'number' },
                            proyecto_nombre: { type: 'string' },
                            total_horas: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, getHoursByProject);

    fastify.get('/reports/hours-weekly', {
        schema: {
            description: 'Horas aprobadas por día dentro de un rango de fechas. Parámetros opcionales: from (YYYY-MM-DD), to (YYYY-MM-DD). Default: últimos 14 días.',
            tags: ['Reportes'],
            querystring: {
                type: 'object',
                properties: {
                    from: { type: 'string', format: 'date', description: 'Fecha de inicio (YYYY-MM-DD)' },
                    to: { type: 'string', format: 'date', description: 'Fecha de fin (YYYY-MM-DD)' },
                },
            },
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            dia: { type: 'string' },
                            total_horas: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, getHoursWeekly);

    fastify.get('/reports/top-students', {
        schema: {
            description: 'Ranking de estudiantes con mayor cantidad de horas aprobadas. Parámetro opcional: limit (default 10).',
            tags: ['Reportes'],
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Cantidad de estudiantes a retornar (default 10)' },
                },
            },
        },
    }, getTopStudents);

    // ── Nuevos reportes ────────────────────────────────────────────────────────

    fastify.get('/reports/hours-by-status', {
        schema: {
            description: 'Distribución de registros y horas totales agrupadas por estado de validación (Aprobado, Pendiente, Rechazado). Útil para medir la carga de trabajo pendiente.',
            tags: ['Reportes'],
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            estado: { type: 'string' },
                            total_registros: { type: 'number' },
                            total_horas: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, getHoursByStatus);

    fastify.get('/reports/institutions', {
        schema: {
            description: 'Resumen de horas aprobadas y cantidad de estudiantes participantes agrupado por institución.',
            tags: ['Reportes'],
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            institucion_id: { type: 'number' },
                            institucion_nombre: { type: 'string' },
                            total_horas: { type: 'number' },
                            total_estudiantes: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, getInstitutionsSummary);

    fastify.get('/reports/completion-rate', {
        schema: {
            description: 'Tasa de cumplimiento de la meta de horas (default 200 h). Retorna totales globales de estudiantes completados, en progreso y sin horas, más detalle individual.',
            tags: ['Reportes'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        meta_horas: { type: 'number' },
                        total_estudiantes: { type: 'number' },
                        completados: { type: 'number' },
                        en_progreso: { type: 'number' },
                        sin_horas: { type: 'number' },
                        tasa_cumplimiento: { type: 'number' },
                        detalle: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id_estudiante: { type: 'number' },
                                    nombre: { type: 'string' },
                                    carnet: { type: 'string' },
                                    horas_aprobadas: { type: 'number' },
                                    porcentaje_completado: { type: 'number' },
                                    estado: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, getCompletionRate);

    fastify.get('/reports/inactive-students', {
        schema: {
            description: 'Lista de estudiantes que no han registrado horas en los últimos N días. Parámetro opcional: dias (default 30). Incluye su última fecha de actividad y total de horas históricas.',
            tags: ['Reportes'],
            querystring: {
                type: 'object',
                properties: {
                    dias: { type: 'integer', minimum: 1, description: 'Días sin actividad para considerar inactivo (default 30)' },
                },
            },
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id_estudiante: { type: 'number' },
                            nombre: { type: 'string' },
                            carnet: { type: 'string' },
                            email: { type: 'string' },
                            ultima_actividad: { type: 'string' },
                            total_horas_historicas: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, getInactiveStudents);

    fastify.get('/reports/student/:id', {
        schema: {
            description: 'Perfil completo de un estudiante: datos personales, resumen de horas por estado, desglose por proyecto e historial cronológico de registros.',
            tags: ['Reportes'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'integer', description: 'ID del usuario/estudiante' },
                },
            },
        },
    }, getStudentDetail);

    fastify.get('/reports/project/:id', {
        schema: {
            description: 'Detalle de un proyecto: nombre, institución, horas totales (aprobadas y pendientes), cantidad de estudiantes y tabla de participantes con sus horas.',
            tags: ['Reportes'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'integer', description: 'ID del proyecto' },
                },
            },
        },
    }, getProjectDetail);

    // ─── NUEVO: Resumen por Grupo ─────────────────────────────────────────────

    fastify.get('/reports/group-summary', {
        schema: {
            description: 'Resumen de avance por grupo y carrera. Muestra para cada grupo: carrera, nombre del grupo, código, total de estudiantes, estudiantes activos, promedios de horas y porcentaje de avance (ambiental y social).',
            tags: ['Reportes'],
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            carrera: { type: 'string' },
                            grupo: { type: 'string' },
                            codigo: { type: 'string' },
                            total_estudiantes: { type: 'number' },
                            estudiantes_activos: { type: 'number' },
                            meta_ambiental: { type: 'number' },
                            meta_social: { type: 'number' },
                            total_horas_ambientales: { type: 'number' },
                            total_horas_sociales: { type: 'number' },
                            promedio_ambiental: { type: 'number' },
                            promedio_social: { type: 'number' },
                            avance_ambiental: { type: 'number' },
                            avance_social: { type: 'number' },
                            tipo: { type: 'string' },
                        },
                    },
                },
            },
        },
    }, getGroupSummary);

    // ── Exportaciones PDF ──────────────────────────────────────────────────────

    fastify.get('/reports/dashboard-pdf', {
        schema: {
            description: 'Exporta un PDF ejecutivo con todos los indicadores clave del sistema: overview, estados, cumplimiento, horas por proyecto/institución, actividad diaria y top estudiantes.',
            tags: ['Reportes', 'PDF'],
        },
    }, exportDashboardPDF);

    fastify.get('/reports/student/:id/pdf', {
        schema: {
            description: 'Exporta un PDF individual de un estudiante con su progreso, desglose por proyecto e historial de actividad.',
            tags: ['Reportes', 'PDF'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'integer', description: 'ID del usuario/estudiante' },
                },
            },
        },
    }, exportStudentPDF);

    // ─── NUEVO: PDF Resumen por Grupo ─────────────────────────────────────────

    fastify.get('/reports/group-pdf', {
        schema: {
            description: 'Exporta un PDF con el resumen completo de avance por grupo, incluyendo gráficas de barras con los top 10 grupos por avance total, top 8 por avance ambiental y top 8 por avance social, más tabla detallada con todos los grupos.',
            tags: ['Reportes', 'PDF'],
        },
    }, exportGroupPDF);

    fastify.get('/reports/carrera/:id', {
        schema: {
            description: 'Obtiene el reporte de una carrera por id, incluyendo totales de estudiantes, grupos y avance de la carrera.',
            tags: ['Reportes'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'integer', description: 'ID de la carrera' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        carrera_id: { type: 'number' },
                        carrera_nombre: { type: 'string' },
                        total_estudiantes: { type: 'number' },
                        total_grupos: { type: 'number' },
                        total_horas_aprobadas: { type: 'number' },
                        total_meta_horas: { type: 'number' },
                        porcentaje_avance: { type: 'number' },
                        estado_estudiantes: {
                            type: 'object',
                            properties: {
                                completado: { type: 'number' },
                                en_progreso: { type: 'number' },
                                sin_horas: { type: 'number' },
                            },
                        },
                        grupos: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    grupo_id: { type: 'number' },
                                    grupo_nombre: { type: 'string' },
                                    grupo_codigo: { type: 'string' },
                                    total_estudiantes: { type: 'number' },
                                    total_horas_aprobadas: { type: 'number' },
                                    total_meta_horas: { type: 'number' },
                                    porcentaje_avance: { type: 'number' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, getCareerReport);

    fastify.get('/reports/carrera/:id/pdf', {
        schema: {
            description: 'Exporta un PDF del reporte de carrera por id con gráficos de pastel, totales de estudiantes, grupos y avance.',
            tags: ['Reportes', 'PDF'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'integer', description: 'ID de la carrera' },
                },
            },
        },
    }, exportCareerPDF);

    // En reportsAnalytics.routes.js - Agregar:

    fastify.get('/reports/general-pdf', {
        schema: {
            description: 'Exporta un PDF con el Reporte General de Gestión, incluyendo gráficas de top proyectos, instituciones, actividad semanal, estado de registros, top estudiantes y top grupos. 2 páginas con análisis completo.',
            tags: ['Reportes', 'PDF'],
        },
    }, exportGeneralReportPDF);

    fastify.get('/reports/advanced-stats-pdf', {
        schema: {
            description: 'Exporta un PDF con estadísticas avanzadas: estudiantes completos/en proceso, estadísticas de carreras, proyectos, solicitudes promedio por proyecto e instituciones frecuentes.',
            tags: ['Reportes', 'PDF'],
        },
    }, exportAdvancedStatsPDF);

    fastify.get('/reports/individual/:id/pdf', {
        schema: {
            description: 'Exporta un PDF con el Reporte Individual de Desempeño de un estudiante, incluyendo perfil, KPIs, progreso ambiental/social, desglose por proyecto y últimos registros.',
            tags: ['Reportes', 'PDF'],
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'integer', description: 'ID del usuario/estudiante' },
                },
            },
        },
    }, exportIndividualReportPDF);

}


export default reportsAnalyticsRoutes;