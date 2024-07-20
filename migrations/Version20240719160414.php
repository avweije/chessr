<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240719160414 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE `group` (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(50) NOT NULL, PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE mistake DROP FOREIGN KEY FK_A7985196A76ED395');
        $this->addSql('DROP INDEX idx_a7985196a76ed395 ON mistake');
        $this->addSql('CREATE INDEX IDX_F01D87B1A76ED395 ON mistake (user_id)');
        $this->addSql('ALTER TABLE mistake ADD CONSTRAINT FK_A7985196A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('DROP INDEX fen_move_idx ON moves');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE `group`');
        $this->addSql('ALTER TABLE mistake DROP FOREIGN KEY FK_F01D87B1A76ED395');
        $this->addSql('DROP INDEX idx_f01d87b1a76ed395 ON mistake');
        $this->addSql('CREATE INDEX IDX_A7985196A76ED395 ON mistake (user_id)');
        $this->addSql('ALTER TABLE mistake ADD CONSTRAINT FK_F01D87B1A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('CREATE UNIQUE INDEX fen_move_idx ON moves (fen, move)');
    }
}
