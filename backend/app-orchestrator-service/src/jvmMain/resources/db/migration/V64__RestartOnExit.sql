alter table app_orchestrator.jobs add column restart_on_exit bool not null default false;
alter table app_orchestrator.jobs add column allow_restart bool not null default false;

create or replace function app_orchestrator.job_to_json(
    job_with_deps app_orchestrator.job_with_dependencies
) returns jsonb language sql as $$
    select jsonb_build_object(
        'specification', jsonb_build_object(
            'application', jsonb_build_object(
                'name', (job_with_deps.job).application_name,
                'version', (job_with_deps.job).application_version
            ),
            'name', (job_with_deps.job).name,
            'replicas', (job_with_deps.job).replicas,
            'timeAllocation', case
                when ((job_with_deps.job).time_allocation_millis) is null then null
                else jsonb_build_object(
                    'hours', ((job_with_deps.job).time_allocation_millis) / (1000 * 60 * 60),
                    'minutes', (((job_with_deps.job).time_allocation_millis) % (1000 * 60 * 60)) / (1000 * 60),
                    'seconds', ((((job_with_deps.job).time_allocation_millis) % (1000 * 60 * 60)) % (1000 * 60) / 1000)
                )
            end,
            'parameters', (
                select coalesce(jsonb_object_agg(p.name, p.value), '{}'::jsonb)
                from unnest(job_with_deps.parameters) p
            ),
            'resources', (
                select coalesce(jsonb_agg(r.resource), '[]'::jsonb)
                from unnest(job_with_deps.resources) r
            ),
            'openedFile', (job_with_deps.job).opened_file,
            'restartOnExit', (job_with_deps.job).restart_on_exit
        ),
        'output', jsonb_build_object(
            'outputFolder', (job_with_deps.job).output_folder
        ),
        'status', jsonb_build_object(
            'state', (job_with_deps.job).current_state,
            'startedAt', floor(extract(epoch from (job_with_deps.job).started_at) * 1000),
            'expiresAt', floor(extract(epoch from (job_with_deps.job).started_at) * 1000) +
                (job_with_deps.job).time_allocation_millis,
            'resolvedApplication', app_store.application_to_json(job_with_deps.application, job_with_deps.tool),
            'jobParametersJson', (job_with_deps.job).job_parameters,
            'allowRestart', (job_with_deps.job).allow_restart
        )
    )
$$;

