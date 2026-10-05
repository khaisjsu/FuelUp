-- Generated from api/app/models.py with pg_dump --schema-only. The API creates these tables itself;
-- this file is for reading and for tools that want plain SQL.

CREATE TABLE public.activities (
    id integer NOT NULL,
    user_id integer NOT NULL,
    kind character varying(40) NOT NULL,
    start timestamp without time zone NOT NULL,
    "end" timestamp without time zone NOT NULL,
    kcal_per_min double precision NOT NULL,
    heart_rate integer NOT NULL
);

CREATE SEQUENCE public.activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;

CREATE TABLE public.hunger_snapshots (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ts timestamp without time zone NOT NULL,
    score integer NOT NULL,
    minutes_to_window integer,
    energy_deficit_kcal integer NOT NULL,
    reason text NOT NULL,
    factors json NOT NULL
);

CREATE SEQUENCE public.hunger_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.hunger_snapshots_id_seq OWNED BY public.hunger_snapshots.id;

CREATE TABLE public.meals (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ts timestamp without time zone NOT NULL,
    label character varying(80) NOT NULL,
    kcal integer NOT NULL,
    carbs_g integer NOT NULL,
    glycemic character varying(8) NOT NULL,
    source character varying(16) NOT NULL,
    order_id integer
);

CREATE SEQUENCE public.meals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.meals_id_seq OWNED BY public.meals.id;

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    name character varying(120) NOT NULL,
    description text NOT NULL,
    price_cents integer NOT NULL,
    kcal integer NOT NULL,
    protein_g integer NOT NULL,
    carbs_g integer NOT NULL,
    fat_g integer NOT NULL,
    fiber_g integer NOT NULL,
    glycemic character varying(8) NOT NULL,
    allergens json NOT NULL,
    tags json NOT NULL
);

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    quantity integer NOT NULL,
    price_cents integer NOT NULL
);

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    restaurant_id integer NOT NULL,
    status character varying(16) NOT NULL,
    trigger character varying(16) NOT NULL,
    confirmed_via character varying(16),
    hunger_score integer,
    reason text NOT NULL,
    subtotal_cents integer NOT NULL,
    delivery_fee_cents integer NOT NULL,
    total_cents integer NOT NULL,
    kcal integer NOT NULL,
    protein_g integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    respond_by timestamp without time zone,
    confirmed_at timestamp without time zone,
    eta timestamp without time zone,
    delivered_at timestamp without time zone
);

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

CREATE TABLE public.readings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ts timestamp without time zone NOT NULL,
    glucose_mgdl double precision,
    heart_rate integer NOT NULL,
    hrv_ms integer NOT NULL,
    active_kcal double precision NOT NULL,
    steps integer NOT NULL
);

CREATE SEQUENCE public.readings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.readings_id_seq OWNED BY public.readings.id;

CREATE TABLE public.restaurants (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    cuisine character varying(60) NOT NULL,
    rating double precision NOT NULL,
    prep_minutes integer NOT NULL,
    travel_minutes integer NOT NULL,
    delivery_partner character varying(40) NOT NULL,
    delivery_fee_cents integer NOT NULL,
    verified boolean NOT NULL
);

CREATE SEQUENCE public.restaurants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id;

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(80) NOT NULL,
    email character varying(120) NOT NULL,
    persona character varying(160) NOT NULL,
    avatar_color character varying(16) NOT NULL,
    devices json NOT NULL,
    weight_kg double precision NOT NULL,
    bmr_kcal_day integer NOT NULL,
    glucose_baseline double precision NOT NULL,
    daily_kcal_target integer NOT NULL,
    protein_target_g integer NOT NULL,
    mode character varying(16) NOT NULL,
    hunger_threshold integer NOT NULL,
    weekly_budget_cents integer NOT NULL,
    max_orders_per_day integer NOT NULL,
    cancel_window_min integer NOT NULL,
    allergies json NOT NULL,
    diet json NOT NULL,
    delivery_address character varying(200) NOT NULL,
    sim_now timestamp without time zone NOT NULL,
    created_at timestamp without time zone NOT NULL
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);

ALTER TABLE ONLY public.hunger_snapshots ALTER COLUMN id SET DEFAULT nextval('public.hunger_snapshots_id_seq'::regclass);

ALTER TABLE ONLY public.meals ALTER COLUMN id SET DEFAULT nextval('public.meals_id_seq'::regclass);

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);

ALTER TABLE ONLY public.readings ALTER COLUMN id SET DEFAULT nextval('public.readings_id_seq'::regclass);

ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hunger_snapshots
    ADD CONSTRAINT hunger_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.readings
    ADD CONSTRAINT readings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX ix_activities_user_id ON public.activities USING btree (user_id);

CREATE INDEX ix_hunger_snapshots_ts ON public.hunger_snapshots USING btree (ts);

CREATE INDEX ix_hunger_snapshots_user_id ON public.hunger_snapshots USING btree (user_id);

CREATE INDEX ix_meals_user_id ON public.meals USING btree (user_id);

CREATE INDEX ix_orders_status ON public.orders USING btree (status);

CREATE INDEX ix_orders_user_id ON public.orders USING btree (user_id);

CREATE INDEX ix_readings_ts ON public.readings USING btree (ts);

CREATE INDEX ix_readings_user_id ON public.readings USING btree (user_id);

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.hunger_snapshots
    ADD CONSTRAINT hunger_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.readings
    ADD CONSTRAINT readings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

