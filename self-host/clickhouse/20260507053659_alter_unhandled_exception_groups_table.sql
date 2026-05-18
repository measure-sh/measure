-- migrate:up
rename table unhandled_exception_groups to fatal_exception_groups;

-- migrate:down
rename table fatal_exception_groups to unhandled_exception_groups;
