<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250810171002 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SEQUENCE analysis_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE archives_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE downloads_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE eco_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE "group_id_seq" INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE ignore_list_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE moves_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE opponent_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE opponent_game_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE opponent_move_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE repertoire_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE repertoire_group_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE settings_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE SEQUENCE user_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE analysis (id INT NOT NULL, user_id INT NOT NULL, white VARCHAR(255) NOT NULL, black VARCHAR(255) NOT NULL, link VARCHAR(255) NOT NULL, type VARCHAR(10) NOT NULL, fen VARCHAR(255) DEFAULT NULL, pgn VARCHAR(2048) DEFAULT NULL, move VARCHAR(10) NOT NULL, best_moves VARCHAR(1024) NOT NULL, initial_fen VARCHAR(255) NOT NULL, color VARCHAR(5) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_33C730A76ED395 ON analysis (user_id)');
        $this->addSql('CREATE TABLE archives (id INT NOT NULL, user_id INT NOT NULL, site VARCHAR(255) NOT NULL, year SMALLINT NOT NULL, first VARCHAR(255) NOT NULL, last VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_E262EC39A76ED395 ON archives (user_id)');
        $this->addSql('CREATE TABLE downloads (id INT NOT NULL, user_id INT DEFAULT NULL, opponent_id INT DEFAULT NULL, site VARCHAR(255) NOT NULL, year INT NOT NULL, month SMALLINT NOT NULL, type VARCHAR(20) NOT NULL, status VARCHAR(255) NOT NULL, date_time TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, last_uuid VARCHAR(255) DEFAULT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_4B73A4B5A76ED395 ON downloads (user_id)');
        $this->addSql('CREATE INDEX IDX_4B73A4B57F656CDC ON downloads (opponent_id)');
        $this->addSql('CREATE TABLE eco (id INT NOT NULL, code VARCHAR(3) NOT NULL, name VARCHAR(255) NOT NULL, pgn VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX idx_eco_pgn ON eco (pgn)');
        $this->addSql('CREATE TABLE "group" (id INT NOT NULL, user_id INT NOT NULL, name VARCHAR(50) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_6DC044C5A76ED395 ON "group" (user_id)');
        $this->addSql('CREATE TABLE ignore_list (id INT NOT NULL, user_id INT NOT NULL, fen VARCHAR(255) NOT NULL, move VARCHAR(10) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_124ECE8CA76ED395 ON ignore_list (user_id)');
        $this->addSql('CREATE TABLE moves (id INT NOT NULL, fen VARCHAR(255) NOT NULL, move VARCHAR(10) NOT NULL, wins INT NOT NULL, draws INT NOT NULL, losses INT NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX idx_moves_fen ON moves (fen)');
        $this->addSql('CREATE TABLE opponent (id INT NOT NULL, parent_id INT DEFAULT NULL, username VARCHAR(255) NOT NULL, site VARCHAR(255) NOT NULL, total INT NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_A9322AFF727ACA70 ON opponent (parent_id)');
        $this->addSql('CREATE TABLE opponent_game (id INT NOT NULL, opponent_id INT NOT NULL, color VARCHAR(5) NOT NULL, result VARCHAR(5) NOT NULL, pgn VARCHAR(2048) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_23CFFF1F7F656CDC ON opponent_game (opponent_id)');
        $this->addSql('CREATE TABLE opponent_move (id INT NOT NULL, opponent_id INT NOT NULL, color VARCHAR(5) NOT NULL, fen VARCHAR(255) NOT NULL, pgn VARCHAR(1000) DEFAULT NULL, move VARCHAR(10) NOT NULL, wins INT NOT NULL, draws INT NOT NULL, losses INT NOT NULL, matches BOOLEAN NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_EFDAF9EB7F656CDC ON opponent_move (opponent_id)');
        $this->addSql('CREATE TABLE repertoire (id INT NOT NULL, user_id INT NOT NULL, color VARCHAR(10) NOT NULL, fen_before VARCHAR(255) NOT NULL, fen_after VARCHAR(255) NOT NULL, pgn VARCHAR(1024) NOT NULL, move VARCHAR(10) NOT NULL, half_move INT NOT NULL, practice_count INT NOT NULL, practice_failed INT NOT NULL, practice_in_arow INT NOT NULL, last_used DATE DEFAULT NULL, initial_fen VARCHAR(255) NOT NULL, auto_play BOOLEAN NOT NULL, exclude BOOLEAN NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_3C367876A76ED395 ON repertoire (user_id)');
        $this->addSql('CREATE TABLE repertoire_group (id INT NOT NULL, repertoire_id INT NOT NULL, grp_id INT NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_B1056021E61B789 ON repertoire_group (repertoire_id)');
        $this->addSql('CREATE INDEX IDX_B105602D51E9150 ON repertoire_group (grp_id)');
        $this->addSql('CREATE TABLE settings (id INT NOT NULL, user_id INT NOT NULL, site VARCHAR(255) DEFAULT NULL, chess_username VARCHAR(255) DEFAULT NULL, lichess_username VARCHAR(255) DEFAULT NULL, board VARCHAR(20) DEFAULT NULL, pieces VARCHAR(20) DEFAULT NULL, animation_duration SMALLINT NOT NULL, animate_variation SMALLINT NOT NULL, repertoire_engine_time SMALLINT NOT NULL, analyse_engine_time SMALLINT NOT NULL, analyse_ignore_inaccuracy BOOLEAN NOT NULL, recommend_interval SMALLINT NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_E545A0C5A76ED395 ON settings (user_id)');
        $this->addSql('CREATE TABLE "user" (id INT NOT NULL, email VARCHAR(180) NOT NULL, roles JSON NOT NULL, password VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_IDENTIFIER_EMAIL ON "user" (email)');
        $this->addSql('ALTER TABLE analysis ADD CONSTRAINT FK_33C730A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE archives ADD CONSTRAINT FK_E262EC39A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE downloads ADD CONSTRAINT FK_4B73A4B5A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE downloads ADD CONSTRAINT FK_4B73A4B57F656CDC FOREIGN KEY (opponent_id) REFERENCES opponent (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE "group" ADD CONSTRAINT FK_6DC044C5A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE ignore_list ADD CONSTRAINT FK_124ECE8CA76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE opponent ADD CONSTRAINT FK_A9322AFF727ACA70 FOREIGN KEY (parent_id) REFERENCES opponent (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE opponent_game ADD CONSTRAINT FK_23CFFF1F7F656CDC FOREIGN KEY (opponent_id) REFERENCES opponent (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE opponent_move ADD CONSTRAINT FK_EFDAF9EB7F656CDC FOREIGN KEY (opponent_id) REFERENCES opponent (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE repertoire ADD CONSTRAINT FK_3C367876A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE repertoire_group ADD CONSTRAINT FK_B1056021E61B789 FOREIGN KEY (repertoire_id) REFERENCES repertoire (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE repertoire_group ADD CONSTRAINT FK_B105602D51E9150 FOREIGN KEY (grp_id) REFERENCES "group" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE settings ADD CONSTRAINT FK_E545A0C5A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('DROP SEQUENCE analysis_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE archives_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE downloads_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE eco_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE "group_id_seq" CASCADE');
        $this->addSql('DROP SEQUENCE ignore_list_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE moves_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE opponent_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE opponent_game_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE opponent_move_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE repertoire_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE repertoire_group_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE settings_id_seq CASCADE');
        $this->addSql('DROP SEQUENCE user_id_seq CASCADE');
        $this->addSql('ALTER TABLE analysis DROP CONSTRAINT FK_33C730A76ED395');
        $this->addSql('ALTER TABLE archives DROP CONSTRAINT FK_E262EC39A76ED395');
        $this->addSql('ALTER TABLE downloads DROP CONSTRAINT FK_4B73A4B5A76ED395');
        $this->addSql('ALTER TABLE downloads DROP CONSTRAINT FK_4B73A4B57F656CDC');
        $this->addSql('ALTER TABLE "group" DROP CONSTRAINT FK_6DC044C5A76ED395');
        $this->addSql('ALTER TABLE ignore_list DROP CONSTRAINT FK_124ECE8CA76ED395');
        $this->addSql('ALTER TABLE opponent DROP CONSTRAINT FK_A9322AFF727ACA70');
        $this->addSql('ALTER TABLE opponent_game DROP CONSTRAINT FK_23CFFF1F7F656CDC');
        $this->addSql('ALTER TABLE opponent_move DROP CONSTRAINT FK_EFDAF9EB7F656CDC');
        $this->addSql('ALTER TABLE repertoire DROP CONSTRAINT FK_3C367876A76ED395');
        $this->addSql('ALTER TABLE repertoire_group DROP CONSTRAINT FK_B1056021E61B789');
        $this->addSql('ALTER TABLE repertoire_group DROP CONSTRAINT FK_B105602D51E9150');
        $this->addSql('ALTER TABLE settings DROP CONSTRAINT FK_E545A0C5A76ED395');
        $this->addSql('DROP TABLE analysis');
        $this->addSql('DROP TABLE archives');
        $this->addSql('DROP TABLE downloads');
        $this->addSql('DROP TABLE eco');
        $this->addSql('DROP TABLE "group"');
        $this->addSql('DROP TABLE ignore_list');
        $this->addSql('DROP TABLE moves');
        $this->addSql('DROP TABLE opponent');
        $this->addSql('DROP TABLE opponent_game');
        $this->addSql('DROP TABLE opponent_move');
        $this->addSql('DROP TABLE repertoire');
        $this->addSql('DROP TABLE repertoire_group');
        $this->addSql('DROP TABLE settings');
        $this->addSql('DROP TABLE "user"');
    }
}
