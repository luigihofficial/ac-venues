-- Importación de contactos de hoteles/venues — Amor Consciente
-- 1) Columna venue (Hotel/Venue) separada del cargo (role)
alter table public.contacts add column if not exists venue text default '';
-- Backfill: filas antiguas guardaban el venue en 'role'
update public.contacts set venue = role where (venue is null or venue = '') and role is not null and role <> '';

-- 2) Insertar los contactos del directorio (evita duplicados por email/venue+name)
insert into public.contacts (city, venue, name, role, email, phone, address, notes)
select v.city, v.venue, v.name, v.role, v.email, v.phone, v.address, v.notes
from (values
  ('Irving, TX','Marriott DFW Airport North (Remington Hotels)','Vickie Dennis','Catering Sales Manager','vickiedennis@remingtonhotels.com','D 972.871.4974 · H 972.929.8800 · F 972.929.6599','8440 Freeport Parkway, Irving, TX 75063',''),
  ('Los Angeles, CA','The Westin Bonaventure Hotel & Suites','Amanda Armas','Catering/Sales','Amanda.Armas@westinbonaventure.com','','Los Angeles, CA','No se listó tel./dirección en el correo'),
  ('Los Angeles, CA','The Westin Bonaventure Hotel & Suites','Allie Michel','Catering/Sales','allie.michel@westinbonaventure.com','','Los Angeles, CA','Contacto en copia'),
  ('Phoenix, AZ','Hilton Phoenix Tapatio Cliffs Resort','Teena Richardson','Senior Catering Sales Manager','teena.richardson@hilton.com','D +1 602 870 8128 · O +1 602 375 5400 Ext.7331','11111 North 7th Street, Phoenix, AZ 85020',''),
  ('Salt Lake City, UT','Hilton Salt Lake City Center (SLCCC)','Lize Cutright','Senior Catering Sales Manager','Lize.Cutright@hilton.com','d +1 801 238 4830','255 South West Temple, Salt Lake City, UT 84101',''),
  ('Salt Lake City, UT','Hilton Salt Lake City Center (SLCCC)','Autumn Mikulenka','Sales / Events','Autumn.Mikulenka@hilton.com','','255 South West Temple, Salt Lake City, UT 84101','Contacto en copia'),
  ('Grapevine, TX','Courtyard by Marriott DFW Airport North (Aimbridge)','Julian Marion','Senior Catering Sales Manager','Julian.Marion@aimbridge.com','(682) 223-1870','Grapevine, TX (no se listó dirección exacta)',''),
  ('Orlando, FL','Embassy Suites Orlando Downtown','Joe Critelli','Sales Manager','joe.critelli@hilton.com','Main +1 407-841-1000 · Office +1 407-835-6857','191 E. Pine Street, Orlando, FL 32801',''),
  ('Orlando, FL','Embassy Suites Orlando Downtown','Geo Cuevas','Sales/Events','Geo.Cuevas2@hilton.com','','191 E. Pine Street, Orlando, FL 32801','Contacto en copia'),
  ('Orlando, FL','Embassy Suites Orlando Downtown','Melissa Martinez','Sales/Events','Melissa.Martinez2@hilton.com','','191 E. Pine Street, Orlando, FL 32801','Contacto en copia'),
  ('Orlando, FL','Orlando World Center Marriott','Grace Beredo','Senior Catering Sales Executive','Grace.Beredo@marriott.com','T 407.238.8702','8701 World Center Drive, Orlando, FL 32821',''),
  ('Los Angeles, CA','The Westin Los Angeles Airport','Victoria Blumer','Senior Catering Sales Executive','Victoria.Blumer@marriott.com','M (424) 445-7867','5400 W Century Blvd, Los Angeles, CA 90045',''),
  ('Orlando, FL','Crowne Plaza Orlando Downtown','Jamie Cooper','Director of Sales & Marketing','jamie@downtowncrowne.com','T 407-367-3626 · D 407-241-1246','304 W. Colonial Drive, Orlando, FL 32801',''),
  ('Orlando, FL','Rosen Plaza Hotel','Amanda Militzer','Catering Coordinator','AMilitzer@rosenplaza.com','407-996-9700 ext. 205-1672 · Direct 407-996-1726','9700 International Drive, Orlando, FL 32819',''),
  ('Orlando, FL','Rosen Centre','Anna Crites','Conference Services Manager','ACrites@rosencentre.com','407.996.1289 · Fax 407.996.2183','9840 International Drive, Orlando, FL 32819',''),
  ('Los Angeles, CA','Embassy Suites LAX North','Rosie Martinez','Sales Manager','romartinez@embassysuiteslax.com','Main 310-215-1000 · Direct 310-337-6025 · Fax 310-215-1952','9801 Airport Boulevard, Los Angeles, CA 90045',''),
  ('Atlanta, GA','Atlanta Marriott Marquis','Britney Lucas','Senior Catering Sales Executive','britney.lucas@marriott.com','404-586-6095 · 470-509-1339','265 Peachtree Center Avenue, Atlanta, GA 30303',''),
  ('Atlanta, GA','Atlanta Marriott Marquis','Havis Bardouille','Sales/Events','Havis.Bardouille@marriott.com','','265 Peachtree Center Avenue, Atlanta, GA 30303','Contacto en copia'),
  ('Atlanta, GA','Atlanta Marriott Marquis','Lauren Roberts','Catering Sales Manager','','','265 Peachtree Center Avenue, Atlanta, GA 30303','No se capturó email/tel. en el correo'),
  ('Irving, TX','Sheraton DFW Airport Hotel','Felicia Leffall','Director of Catering & Conference Services','Felicia.Leffall@sheratondfwairport.com','O 972 929 8400 x328 · M 214 206 0759','4440 W. John Carpenter Fwy, Irving, TX 75063',''),
  ('Irving, TX','Sheraton DFW Airport Hotel','Emily Olivas','Accounts Receivables Manager','EOlivas@sheratondfwairport.com','O 972 929 8400','4440 W. John Carpenter Fwy, Irving, TX 75063',''),
  ('Irving, TX','Sheraton DFW Airport Hotel','Lavell Donald','Sales/Events','Lavell.Donald@sheratondfwairport.com','','4440 W. John Carpenter Fwy, Irving, TX 75063','Contacto en copia'),
  ('Glendale, CA','Embassy Suites Los Angeles Glendale','Angel Cassio','Director of Sales & Marketing','angel.cassio2@hilton.com','O +1 818 627 3903','800 North Central Ave, Glendale, CA 91203',''),
  ('Glendale, CA','Embassy Suites Los Angeles Glendale','Le Yang','Catering Sales Manager','le.yang@hilton.com','O +1 818 627 3908 · Fax +1 818 550 0828','800 North Central Ave, Glendale, CA 91203',''),
  ('Atlanta, GA','The Westin Peachtree Plaza, Atlanta','Jonathan Cooke','Senior Group Sales Coordinator','jonathan.cooke@westin.com','Hotel +1 404.659.1400 · Direct +1 470.597.2543','210 Peachtree St NW, Atlanta, GA 30303',''),
  ('Houston, TX','DoubleTree by Hilton Houston Greenway Plaza','Autumn Mikulenka Paxton','Group Sales Manager','Autumn.Mikulenka@hilton.com','Direct 713-850-2327 · Fax 713-850-2326','6 East Greenway Plaza, Houston, TX 77046',''),
  ('Miami, FL','Marriott Miami Airport','Mariela Cuevas','Sr. Catering Sales Executive','Mariela.Cuevas@marriott.com','(305) 644-5695 · C (305) 796-7653','1201 NW LeJeune Road, Miami, FL 33126',''),
  ('Lake Buena Vista, FL','Walt Disney World Swan & Dolphin Resort (y Swan Reserve)','Jennifer Sharpe','Senior Catering Sales Manager','jennifer.sharpe@swandolphin.com','P 407.934.1883 · D 407.934.1860 · C 407.739.0050','1200 Epcot Resorts Boulevard, Lake Buena Vista, FL 32830',''),
  ('Orlando, FL','Renaissance Orlando Airport Hotel','Cynthia Feliciano','Catering Sales Manager','Cynthia.Feliciano@renaissancehotels.com','T 407.513.7232 · F 407.698.1027','5445 Forbes Place, Orlando, FL 32812',''),
  ('Orlando, FL','Renaissance Orlando at SeaWorld','Stephanie Maningo','Senior Catering Sales Executive','Stephanie.Maningo@marriott.com','T +1 407 248 7354','6677 Sea Harbor Drive, Orlando, FL 32821',''),
  ('Orlando, FL','Renaissance Orlando at SeaWorld','Caroline Sanchez','Group Housing Coordinator','Caroline.Sanchez@renaissancehotels.com','T 407.248.7328','6677 Sea Harbor Drive, Orlando, FL 32821',''),
  ('Orlando, FL','Renaissance Orlando at SeaWorld','Giselle Chin','Event Manager','Giselle.Chin@renhotels.com','T 407.248.7374','6677 Sea Harbor Drive, Orlando, FL 32821',''),
  ('Orlando, FL','Renaissance Orlando at SeaWorld','Cesia Barrera','General Accountant','cesia.barrera@marriott.com','T 407-248-7430','6677 Sea Harbor Drive, Orlando, FL 32821',''),
  ('Salt Lake City, UT','Salt Palace Convention Center','Roseann Hernandez','Senior Sales Manager','RoseannH@saltpalace.com','O 385-468-2210','100 S W Temple St, Salt Lake City, UT 84101',''),
  ('Sandy, UT','Mountain America Exposition Center','Tate (Chelsea) Moffett','Sales Manager','tate.m@mountainamericaexpo.com','O 385-468-2289 · C 801-941-3847','9575 State Street, Sandy, UT 84070',''),
  ('Sandy, UT','Mountain America Exposition Center','Teri Cowburn','Sales/Events','teri.c@mountainamericaexpo.com','','9575 State Street, Sandy, UT 84070','Contacto en copia'),
  ('Orlando, FL','Hyatt Regency Orlando','Erika Galindo','Event Sales Manager','erika.galindo@hyatt.com','+1 407 248 6130','9801 International Drive, Orlando, FL 32819',''),
  ('Orlando, FL','Hyatt Regency Orlando','Caden Murray','Sales (intro)','','','9801 International Drive, Orlando, FL 32819','Presentó a Erika; email no capturado'),
  ('Irving, TX','DoubleTree by Hilton DFW Airport North','Kary Evans','Sales Executive Meeting Manager','Kary.Evans@hilton.com','Direct (972) 815-0210 · Hotel (972) 929-8181 Ext 2227','4441 West John Carpenter Freeway, Irving, TX 75063','')
) as v(city, venue, name, role, email, phone, address, notes)
where not exists (
  select 1 from public.contacts c
  where lower(coalesce(c.venue,''))=lower(v.venue) and lower(coalesce(c.name,''))=lower(v.name)
);
