CREATE DATABASE IF NOT EXISTS urban_mobility;
USE urban_mobility;

CREATE TABLE zones (
    location_id   INT PRIMARY KEY,
    borough       VARCHAR(50)  NOT NULL,
    zone          VARCHAR(100) NOT NULL,
    service_zone  VARCHAR(50)
);

CREATE TABLE trips (
    trip_id              INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id            TINYINT,
    pickup_datetime      DATETIME     NOT NULL,
    dropoff_datetime     DATETIME     NOT NULL,
    passenger_count      TINYINT,
    trip_distance        FLOAT,
    pu_location_id       INT          NOT NULL,
    do_location_id       INT          NOT NULL,
    rate_code_id         TINYINT,
    payment_type         TINYINT,
    fare_amount          DECIMAL(8,2),
    tip_amount           DECIMAL(8,2),
    total_amount         DECIMAL(8,2),
    duration_min         FLOAT,
    avg_speed_mph        FLOAT,
    tip_percentage       FLOAT,
    time_of_day          VARCHAR(20),

    FOREIGN KEY (pu_location_id) REFERENCES zones(location_id),
    FOREIGN KEY (do_location_id) REFERENCES zones(location_id),

    INDEX idx_pickup_time  (pickup_datetime),
    INDEX idx_pu_location  (pu_location_id),
    INDEX idx_do_location  (do_location_id),
    INDEX idx_time_of_day  (time_of_day)
);

CREATE TABLE excluded_records (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    raw_data         TEXT,
    exclusion_reason VARCHAR(100),
    logged_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);