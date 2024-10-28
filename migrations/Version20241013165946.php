<?php

declare(strict_types=1);

namespace main;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20241013165946 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE downloads ADD opponent_id INT DEFAULT NULL, CHANGE user_id user_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE downloads ADD CONSTRAINT FK_4B73A4B57F656CDC FOREIGN KEY (opponent_id) REFERENCES opponent (id)');
        $this->addSql('CREATE INDEX IDX_4B73A4B57F656CDC ON downloads (opponent_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE downloads DROP FOREIGN KEY FK_4B73A4B57F656CDC');
        $this->addSql('DROP INDEX IDX_4B73A4B57F656CDC ON downloads');
        $this->addSql('ALTER TABLE downloads DROP opponent_id, CHANGE user_id user_id INT NOT NULL');
    }
}
