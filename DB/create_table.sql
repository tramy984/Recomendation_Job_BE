CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('candidate', 'recruiter','admin')),
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE industry (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);
CREATE TABLE level_table (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
CREATE TABLE company (
    company_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(255),
    description TEXT,
    location VARCHAR(255),
    url_website VARCHAR(500),
    url_facebook VARCHAR(500),
    certificate TEXT,
    logo TEXT
);
CREATE TABLE careers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry_id BIGINT,
    CONSTRAINT fk_career_industry
        FOREIGN KEY (industry_id)
        REFERENCES industry(id)
);
CREATE TABLE candidate_profile (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    gender BOOLEAN,
    date_of_birth DATE,
    avatar TEXT,
    CONSTRAINT fk_candidate_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);
CREATE TABLE recruiter (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    gender BOOLEAN,
    location VARCHAR(255),
    date_of_birth DATE,
    avatar TEXT,
    company_id BIGINT,
    is_verify_phone BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_recruiter_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),
    CONSTRAINT fk_recruiter_company
        FOREIGN KEY (company_id)
        REFERENCES company(company_id)
);
CREATE TABLE pending_companies (
    id BIGSERIAL PRIMARY KEY,
    recruiter_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(255),
    description TEXT,
    location VARCHAR(255),
    reviewed_by BIGINT,
    url_website VARCHAR(500),
    url_facebook VARCHAR(500),

    logo TEXT,

    certificate TEXT,

    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),

    reject_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    CONSTRAINT fk_pending_company_recruiter
        FOREIGN KEY (recruiter_id)
        REFERENCES recruiter(id),
    CONSTRAINT fk_pending_company_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
);
CREATE TABLE pending_company_industries (
    id BIGSERIAL PRIMARY KEY,

    pending_company_id BIGINT NOT NULL,
    industry_id BIGINT NOT NULL,

    CONSTRAINT fk_pending_company_industry_pending_company
        FOREIGN KEY (pending_company_id)
        REFERENCES pending_companies(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pending_company_industry_industry
        FOREIGN KEY (industry_id)
        REFERENCES industry(id)
        ON DELETE CASCADE
);
CREATE TABLE company_industry (
    id BIGSERIAL PRIMARY KEY,
    id_company BIGINT,
    id_industry BIGINT,
    CONSTRAINT fk_company_industry_company
        FOREIGN KEY (id_company)
        REFERENCES company(company_id),
    CONSTRAINT fk_company_industry_industry
        FOREIGN KEY (id_industry)
        REFERENCES industry(id)
);
CREATE TABLE job_type (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    career_id BIGINT,
    company_id BIGINT,
    recruiter_id BIGINT,
    salary_min BIGINT,
    salary_max BIGINT,
    status BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expire TIMESTAMP,
    location VARCHAR(255),
    id_level BIGINT,
    job_type_id BIGINT,
    candidate_number BIGINT,
    exp_min BIGINT,
    exp_max BIGINT,
    job_benefit TEXT,
    job_requirement TEXT,
    applied_number BIGINT DEFAULT 0,
    CONSTRAINT fk_jobs_career
        FOREIGN KEY (career_id)
        REFERENCES careers(id),
    CONSTRAINT fk_jobs_company
        FOREIGN KEY (company_id)
        REFERENCES company(company_id),
    CONSTRAINT fk_jobs_recruiter
        FOREIGN KEY (recruiter_id)
        REFERENCES recruiter(id),
    CONSTRAINT fk_jobs_level
        FOREIGN KEY (id_level)
        REFERENCES level_table(id),
    CONSTRAINT fk_jobs_job_type
        FOREIGN KEY (job_type_id)
        REFERENCES job_type(id)
);
CREATE TABLE cvs (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_default BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_cvs_candidate
        FOREIGN KEY (candidate_id)
        REFERENCES candidate_profile(id)
);
CREATE TABLE applications (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT,
    cv_id BIGINT,
    job_id BIGINT,
    status VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    reason_reject TEXT,
    CONSTRAINT fk_app_candidate
        FOREIGN KEY (candidate_id)
        REFERENCES candidate_profile(id),
    CONSTRAINT fk_app_cv
        FOREIGN KEY (cv_id)
        REFERENCES cvs(id),
    CONSTRAINT fk_app_job
        FOREIGN KEY (job_id)
        REFERENCES jobs(id)
);
CREATE TABLE saved_jobs (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT,
    job_id BIGINT,
    CONSTRAINT fk_saved_candidate
        FOREIGN KEY (candidate_id)
        REFERENCES candidate_profile(id),
    CONSTRAINT fk_saved_job
        FOREIGN KEY (job_id)
        REFERENCES jobs(id)
);
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT,
    receiver_id BIGINT,
    title VARCHAR(255),
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id),
    CONSTRAINT fk_notification_receiver
        FOREIGN KEY (receiver_id)
        REFERENCES users(id)
);
