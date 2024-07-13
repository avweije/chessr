<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240713074436 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE downloads (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, site VARCHAR(255) NOT NULL, year INT NOT NULL, month SMALLINT NOT NULL, type VARCHAR(20) NOT NULL, status VARCHAR(255) NOT NULL, date_time DATETIME NOT NULL, last_uuid VARCHAR(255) DEFAULT NULL, INDEX IDX_4B73A4B5A76ED395 (user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE downloads ADD CONSTRAINT FK_4B73A4B5A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('DROP TABLE moves_bulk');
        $this->addSql('DROP INDEX moves_fen_move ON moves');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE moves_bulk (id INT AUTO_INCREMENT NOT NULL, fen VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_unicode_ci`, move VARCHAR(10) CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_unicode_ci`, wins INT NOT NULL, draws INT NOT NULL, losses INT NOT NULL, INDEX moves_fen_move (fen, move), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB COMMENT = \'\' ');
        $this->addSql('ALTER TABLE downloads DROP FOREIGN KEY FK_4B73A4B5A76ED395');
        $this->addSql('DROP TABLE downloads');
        $this->addSql('CREATE INDEX moves_fen_move ON moves (fen, move)');
    }
}
