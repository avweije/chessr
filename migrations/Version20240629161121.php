<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240629161121 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE repertoire (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, color VARCHAR(10) NOT NULL, fen_before VARCHAR(255) NOT NULL, fen_after VARCHAR(255) NOT NULL, pgn VARCHAR(255) NOT NULL, move VARCHAR(10) NOT NULL, half_move INT NOT NULL, practice_count INT NOT NULL, practice_failed INT NOT NULL, practice_in_arow INT NOT NULL, INDEX IDX_3C367876A76ED395 (user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE repertoire ADD CONSTRAINT FK_3C367876A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE repertoire DROP FOREIGN KEY FK_3C367876A76ED395');
        $this->addSql('DROP TABLE repertoire');
    }
}
